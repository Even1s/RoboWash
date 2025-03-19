const {Scenes, Markup} = require("telegraf");
const { adminMenu, generateTimeIntervals, getFreeTime } = require("../shared");
const pool = require("../db");


module.exports = new Scenes.WizardScene(
    'REPORT_SCENE',
    async (ctx) => {
        await ctx.reply(
            'Отчеты:\n' +
            '1. Загруженность \n' +
            '2. Популярность \n' +
            '3. Доходы', {
            ...Markup.keyboard(["Загруженность", "Популярность", "Доходы", "Назад"]).resize()
        });
        return ctx.wizard.next();
    },
    async (ctx) => {
        const value = ctx.message.text;
        ctx.wizard.state.type = value;
        switch (value) {
            case 'Загруженность':
                await ctx.reply('Введите начало периода (yyyy-mm-dd):', {...Markup.removeKeyboard(true)});
                return ctx.wizard.next();
            case 'Популярность':
                await ctx.reply('Введите начало периода (yyyy-mm-dd):', {...Markup.removeKeyboard(true)});
                return ctx.wizard.next();
            case 'Доходы':
                await ctx.reply('Введите начало периода (yyyy-mm-dd):', {...Markup.removeKeyboard(true)});
                return ctx.wizard.next();
            case 'Назад':
                await adminMenu(ctx);
                return ctx.scene.leave();
            default: return;
        }
    },
    async (ctx) => {
        ctx.wizard.state.start = ctx.message.text;
        await ctx.reply('Введите конец периода (yyyy-mm-dd):');
        return ctx.wizard.next();
    },
    async (ctx) => {
        ctx.wizard.state.end = ctx.message.text;
        switch (ctx.wizard.state.type) {
            case 'Загруженность': {
                const responseBoxes = await pool.query('select * from boxes');
                const boxes = responseBoxes.rows;

                const responseAppointments = await pool.query(
                    'select * from appointments ' +
                    'join boxes using (box_id) ' +
                    'join services using (service_id) ' +
                    'where (date >= $1 or date <= $2)',
                    [`${ctx.wizard.state.start} 00:00:00`, `${ctx.wizard.state.end} 23:59:59`]
                )
                const appointments = responseAppointments.rows;

                let text = '';
                boxes.forEach((box, index) => {
                    const appointmentsInBoxes = appointments.filter((appointment) => appointment.box_id === box.box_id);
                    const intervals = generateTimeIntervals(box.start_time, box.end_time);
                    const freeTime = getFreeTime(appointmentsInBoxes, box.start_time, box.end_time);
                    text += `${index+1}. ${box.box_name}: ${(((freeTime.length / intervals.length) - 1) * (-100)).toFixed(2)}%\n`;
                })

                await ctx.reply(`Отчет загруженности за период от ${ctx.wizard.state.start} до ${ctx.wizard.state.end}\n` +
                    text, {
                    ...Markup.keyboard(["Загруженность", "Популярность", "Доходы", "Назад"]).resize()
                });
                break;
            }
            case 'Популярность': {
                const responseServices = await pool.query('select * from services');
                const services = responseServices.rows;

                const responseAppointments = await pool.query(
                    'select * from appointments ' +
                    'join boxes using (box_id) ' +
                    'join services using (service_id) ' +
                    'where (date >= $1 or date <= $2)',
                    [`${ctx.wizard.state.start} 00:00:00`, `${ctx.wizard.state.end} 23:59:59`]
                )
                const appointments = responseAppointments.rows;

                let text = '';
                services.forEach((service, index) => {
                    const serviceAppointments = appointments.filter((appointment) => appointment.service_id === service.service_id)
                    text += `${index+1}. ${service.service_name}: ${serviceAppointments.length}\n`
                })

                await ctx.reply(`Отчет популярности за период от ${ctx.wizard.state.start} до ${ctx.wizard.state.end}\n` +
                    text, {
                    ...Markup.keyboard(["Загруженность", "Популярность", "Доходы", "Назад"]).resize()
                });
                break;
            }
            case 'Доходы': {
                const response = await pool.query(
                    'select * from appointments ' +
                    'join services using (service_id) ' +
                    'where (date >= $1 or date <= $2)',
                    [`${ctx.wizard.state.start} 00:00:00`, `${ctx.wizard.state.end} 23:59:59`]
                );
                const appointments = response.rows;

                let sum = 0;
                appointments.forEach((appointment) => {
                    sum += Math.max((parseInt(appointment.service_cost) - appointment.used_bonuses), 0);
                });

                await ctx.reply(`Доходы за период от ${ctx.wizard.state.start} до ${ctx.wizard.state.end} составили: ${sum}`, {
                    ...Markup.keyboard(["Загруженность", "Популярность", "Доходы", "Назад"]).resize()
                });
                break;
            }
            case 'Назад':
                await adminMenu(ctx);
                return ctx.scene.leave();
        }
        return ctx.wizard.selectStep(1);
    }
)