const {Scenes, Markup} = require("telegraf");
const { getFreeTime, getRowsArray, userMenu} = require("../shared");
const pool = require("../db");


module.exports = new Scenes.WizardScene(
    'SIGN_UP_SCENE',
    async (ctx) => {
        const response = await pool.query('select * from boxes');
        ctx.wizard.state.boxes = response.rows;
        if (!ctx.wizard.state.boxes.length) {
            await ctx.reply('Боксы: Не найдены');
            await userMenu(ctx);
            return ctx.scene.leave();
        }
        let boxesText = 'Боксы:\n';
        ctx.wizard.state.boxes.forEach((box, index) => {
            boxesText += `${index+1}. ${box.box_name}\n`;
        })
        await ctx.reply('Выберите бокс\n' + boxesText, {
            ...Markup.keyboard(getRowsArray(ctx.wizard.state.boxes.map((box, index) => `${index+1}`))).resize()
        });
        ctx.wizard.state.appointment = {};
        return ctx.wizard.next();
    },
    async (ctx) => {
        ctx.wizard.state.appointment.box = ctx.wizard.state.boxes[parseInt(ctx.message.text)-1];

        const response = await pool.query(
            'select * from services ' +
            'join services_in_boxes using (service_id) ' +
            'where box_id = $1',
            [ctx.wizard.state.appointment.box.box_id]);
        ctx.wizard.state.services = response.rows;

        if (!ctx.wizard.state.services.length) {
            await ctx.reply('Услуги: Не найдены');
            await userMenu(ctx);
            return ctx.scene.leave();
        }
        let servicesText = 'Услуги:\n';
        ctx.wizard.state.services.forEach((service, index) => {
            servicesText += `${index+1}. ${service.service_name}: ${service.service_cost}\n`;
        })
        await ctx.reply('Выберите услугу\n' + servicesText, {
            ...Markup.keyboard(getRowsArray(ctx.wizard.state.services.map((service, index) => `${index+1}`))).resize()
        });
        return ctx.wizard.next();
    },
    async (ctx) => {
        ctx.wizard.state.appointment.service = ctx.wizard.state.services[parseInt(ctx.message.text) - 1];
        const response = await pool.query('select * from users where chat_id = $1', [ctx.chat.id]);
        ctx.wizard.state.user = response.rows[0];
        await ctx.reply(`Использовать бонусы? У вас ${ctx.wizard.state.user.bonuses}`, {...Markup.keyboard(["Да", "Нет"])});
        return ctx.wizard.next();
    },
    async (ctx) => {
        switch (ctx.message.text) {
            case 'Да':
                ctx.wizard.state.appointment.bonuses = true;
                break;
            case 'Нет':
                ctx.wizard.state.appointment.bonuses = true;
                break;
            default: return;
        }
        await ctx.reply('Дата (yyyy-mm-dd):', {...Markup.removeKeyboard(true)});
        return ctx.wizard.next();
    },
    async (ctx) => {
        const date = new Date(ctx.message.text);
        if (date < (new Date(Date.now())).setHours(0, 0, 0, 0)) {
            await ctx.reply('Введите дату больше сегодняшней')
            return;
        }
        ctx.wizard.state.appointment.date = date;

        const response = await pool.query(
            'select * from appointments ' +
            'join boxes using (box_id) ' +
            'join services using (service_id) ' +
            'where box_id = $1 ' +
            'and extract(year from date) = $2 ' +
            'and extract(month from date) = $3 ' +
            'and extract(day from date) = $4',
            [ctx.wizard.state.appointment.box.box_id, date.getFullYear(), date.getMonth()+1, date.getDate()]
        );
        const appointments = response.rows;

        const freeTime = getFreeTime(
            appointments,
            ctx.wizard.state.appointment.box.start_time,
            ctx.wizard.state.appointment.box.end_time,
            ctx.wizard.state.appointment.service.duration
        );

        await ctx.reply('Время:', {
            ...Markup.keyboard(getRowsArray(freeTime, 4)).resize()
        });
        return ctx.wizard.next();
    },
    async (ctx) => {
        const date = ctx.wizard.state.appointment.date;
        const time = ctx.message.text.split(':').map(Number);
        date.setUTCHours(time[0], time[1], 0);
        if (date < Date.now()) {
            await ctx.reply('Введите дату больше сегодняшней')
            return;
        }
        ctx.wizard.state.appointment.date = date;
        ctx.wizard.state.appointment.date = ctx.wizard.state.appointment.date.toISOString().replace('T', ' ').split('.')[0];
        const appointment = ctx.wizard.state.appointment;
        await ctx.reply(
            `Данные верны?\n\n` +
            `Услуга: ${appointment.service.service_name}\n` +
            `Бокс: ${appointment.box.box_name}\n` +
            `Цена: ${appointment.service.service_cost}\n` +
            `Скидка: ${ctx.wizard.state.user.bonuses}\n` +
            `Сумма: ${Math.max((parseInt(appointment.service.service_cost) - ctx.wizard.state.user.bonuses), 0)} ` +
            `${appointment.service.service_cost.substring(appointment.service.service_cost.length-1)}\n` +
            `Дата: ${appointment.date}\n`
            , {
                ...Markup.keyboard(["Да", "Нет", "Отмена"]).resize()
            });
        return ctx.wizard.next();
    },
    async (ctx) => {
        const command = ctx.message.text;
        if (command === "Нет") {
            let boxesText = 'Боксы:\n';
            ctx.wizard.state.boxes.forEach((box, index) => {
                boxesText += `${index+1}. ${box.box_name}\n`;
            })
            await ctx.reply('Выберите бокс\n' + boxesText, {
                ...Markup.keyboard(getRowsArray(ctx.wizard.state.boxes.map((box, index) => `${index+1}`))).resize()
            });
            ctx.wizard.state.appointment = {};
            return ctx.wizard.selectStep(1);
        } else if (command === 'Да') {
            const appointment = ctx.wizard.state.appointment;
            await pool.query(
                'INSERT INTO appointments(box_id, service_id, date, user_id, used_bonuses) ' +
                'VALUES ($1, $2, $3, $4, $5);',
                [appointment.box.box_id, appointment.service.service_id, appointment.date, ctx.chat.id, appointment.bonuses ? ctx.wizard.state.user.bonuses : 0],
            )
            await ctx.reply('Успешно', {...Markup.removeKeyboard(true)});
            return ctx.scene.enter('HISTORY_SCENE');
        } else if (command === 'Отмена') {
            await userMenu(ctx);
            return ctx.scene.leave();
        } else return;
    }
)