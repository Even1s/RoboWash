const {Scenes, Markup, session} = require("telegraf");
const pool = require('../db');
const { adminMenu, reloadAdmins, userMenu} = require("../shared");
const Storage = require("node-storage");

const store = () => new Storage('./storage.json');

module.exports = new Scenes.WizardScene(
    'REGISTRATION_SCENE',
    async (ctx) => {
        await ctx.reply('Добро пожаловать в бот RoboWash', {
            ...Markup.keyboard(["Регистрация", "Админ"]).resize()
        });
        return ctx.wizard.next();
    },
    async (ctx) => {
        const command = ctx.message.text;
        if (command === "Регистрация") {
            await ctx.reply('Ваше имя:', {...Markup.removeKeyboard(true)});
            ctx.wizard.state.userData = {};
            return ctx.wizard.selectStep(3);
        } else if (command === 'Админ') {
            await ctx.reply('Пароль:', {...Markup.removeKeyboard(true)});
            return ctx.wizard.next();
        }
        else return;
    },
    async (ctx) => {
        const password = ctx.message.text;
        if (password === process.env.ADMIN_PASSWORD) {
            pool.query('insert into admins values($1)', [ctx.chat.id]);
            await ctx.reply('Успешно');
            store().put('admins', await reloadAdmins());
            await adminMenu(ctx);
            return ctx.scene.leave();
        } else {
            await ctx.reply('Неверный пароль');
            return;
        }
    },
    async (ctx) => {
        const name = ctx.message.text;
        if (name.length < 3) {
            await ctx.reply('Напишите свое реальное имя');
            return;
        }
        ctx.wizard.state.userData.name = name;
        await ctx.reply('Ваша фамилия:');
        return ctx.wizard.next();
    },
    async (ctx) => {
        const lastName = ctx.message.text;
        if (lastName.length < 3) {
            await ctx.reply('Напишите свою реальную фамилию');
            return;
        }
        ctx.wizard.state.userData.lastName = lastName;
        await ctx.reply('Ваше отчество (если есть):', {
            ...Markup.keyboard(["Нет отчества"]).resize()
        });
        return ctx.wizard.next();
    },
    async (ctx) => {
        const patronymic = ctx.message?.text;
        if (patronymic.length < 3) {
            await ctx.reply('Напишите свое реальное отчество');
            return;
        }
        ctx.wizard.state.userData.patronymic = patronymic === "Нет отчества" ? null : patronymic;
        await ctx.reply(`Номер Вашего автомобиля (А999АА99):`, {...Markup.removeKeyboard(true)});
        return ctx.wizard.next();
    },
    async (ctx) => {
        const car = ctx.message?.text ?? '';
        if (!car.match(/^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/g)) {
            await ctx.reply('Напишите реальный номер автомобиля');
            return;
        }
        ctx.wizard.state.userData.car = car;
        const user = ctx.wizard.state.userData;
        await ctx.reply(
            `Ваши данные верны?\n\n` +
            `Имя: ${user.name}\n` +
            `Фамилия: ${user.lastName}\n` +
            `Отчество: ${user.patronymic ?? 'Нет'}\n` +
            `Номер машины: ${user.car}\n`
            , {
                ...Markup.keyboard(["Да", "Нет"]).resize()
            });
        return ctx.wizard.next();
    },
    async (ctx) => {
        const command = ctx.message.text;
        if (command === "Нет") {
            await ctx.reply('Ваше имя:', {...Markup.removeKeyboard(true)});
            ctx.wizard.state.userData = {};
            return ctx.wizard.selectStep(3);
        } else if (command === 'Да') {
            const user = ctx.wizard.state.userData;
            await pool.query(
                'INSERT INTO public.users(chat_id, first_name, last_name, patronymic, car_number) VALUES ($1, $2, $3, $4, $5);',
                [ctx.chat.id, user.name, user.lastName, user.patronymic, user.car]);
            await ctx.reply('Регистрация успешна', {...Markup.removeKeyboard(true)});
            await userMenu(ctx)
            return ctx.scene.leave();
        }
        else return;
    }
)