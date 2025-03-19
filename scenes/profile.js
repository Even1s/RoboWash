const {Scenes, Markup} = require("telegraf");
const { adminMenu, generateTimeIntervals, getFreeTime, userMenu} = require("../shared");
const pool = require("../db");


module.exports = new Scenes.WizardScene(
    'PROFILE_SCENE',
    async (ctx) => {
        const response = await pool.query("SELECT * FROM users WHERE chat_id = $1", [ctx.chat.id]);
        const profile = response.rows[0];

        await ctx.reply(
            'Профиль:\n' +
            `ФИО: ${profile.last_name} ${profile.first_name} ${profile.patronymic ?? ''}\n` +
            `Машина: ${profile.car_number}\n` +
            `Бонусы: ${profile.bonuses}`, {
                ...Markup.keyboard(["Редактировать", "Назад"]).resize()
            });
        return ctx.wizard.next();
    },
    async (ctx) => {
        const value = ctx.message.text;
        switch (value) {
            case 'Назад': {
                await userMenu(ctx);
                return ctx.scene.leave();
            } case 'Редактировать': {
                await ctx.reply(
                    'Какой параметр редактировать'
                    , {...Markup.keyboard([
                            "Имя",
                            "Фамилия",
                            "Отчество",
                            "Номер машины",
                            "Отмена"
                        ]).resize()
                    });
                return ctx.wizard.next();
            } default: return;
        }
    },
    async (ctx) => {
        const value = ctx.message.text;
        switch (value) {
            case 'Имя': {
                await ctx.reply('Ваше имя:', {...Markup.keyboard(["Отмена"]).resize()});
                ctx.wizard.state.editing = 'name';
                return ctx.wizard.next();
            } case 'Фамилия': {
                await ctx.reply('Ваша фамилия:', {...Markup.keyboard(["Отмена"]).resize()});
                ctx.wizard.state.editing = 'last-name';
                return ctx.wizard.next();
            } case 'Отчество': {
                await ctx.reply('Ваше отчество (если есть):', {
                    ...Markup.keyboard(["Нет отчества"]).resize()
                });
                ctx.wizard.state.editing = 'patronymic';
                return ctx.wizard.next();
            } case 'Номер машины': {
                await ctx.reply(`Номер Вашего автомобиля (А999АА99):`, {...Markup.keyboard(["Отмена"]).resize()});
                ctx.wizard.state.editing = 'car';
                return ctx.wizard.next();
            } case 'Отмена': {
                await ctx.reply(`Редактирование отменено`, {...Markup.keyboard(["Отмена"]).resize()});
                return ctx.scene.enter('PROFILE_SCENE');
            }
        }
    },
    async (ctx) => {
        const value = ctx.message.text;
        if (value === "Отмена") {
            await ctx.reply(`Редактирование отменено`, {...Markup.removeKeyboard(true)});
            return ctx.scene.enter('PROFILE_SCENE');
        }
        switch (ctx.wizard.state.editing) {
            case 'name': {
                if (value.length < 3) {
                    await ctx.reply('Напишите свое реальное имя');
                    return;
                }
                await pool.query(
                    'UPDATE public.users SET first_name=$1 WHERE chat_id = $2;',
                    [value, ctx.chat.id]
                )
                return ctx.scene.enter('PROFILE_SCENE');
            } case 'last-name': {
                if (value.length < 3) {
                    await ctx.reply('Напишите свою реальную фамилию');
                    return;
                }
                await pool.query(
                    'UPDATE public.users SET last_name=$1 WHERE chat_id = $2;',
                    [value, ctx.chat.id]
                )
                return ctx.scene.enter('PROFILE_SCENE');
            } case 'patronymic': {
                if (value.length < 3) {
                    await ctx.reply('Напишите свое реальное отчество');
                    return;
                }
                await pool.query(
                    'UPDATE public.users SET patronymic=$1 WHERE chat_id = $2;',
                    [value === "Нет отчества" ? null : value, ctx.chat.id]
                )
                return ctx.scene.enter('PROFILE_SCENE');
            } case 'car': {
                if (!value.match(/^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/g)) {
                    await ctx.reply('Напишите реальный номер автомобиля');
                    return;
                }
                await pool.query(
                    'UPDATE public.users SET car_number=$1 WHERE chat_id = $2;',
                    [value, ctx.chat.id]
                )
                return ctx.scene.enter('PROFILE_SCENE');
            }
        }
    }
)