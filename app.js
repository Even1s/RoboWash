const { Telegraf, session, Scenes} = require("telegraf");
const pool = require('./db');
require('dotenv').config();
const Storage = require("node-storage");
const {
    registration, boxes, createBox, services, createService, appointments, createAppointment, reports,
    profile, history, signUp
} = require('./scenes');
const { reloadAdmins, adminMenu, userMenu} = require("./shared");

const store = () => new Storage('./storage.json');
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

const stage = new Scenes.Stage([
    registration, boxes, createBox, services, createService, appointments, createAppointment, reports,
    profile, history, signUp
]);
bot.use(
    session(),
    stage?.middleware()
);

bot.start(async (ctx) => {
    if (store().get('admins').includes(ctx.chat.id)) {
        await adminMenu(ctx);
        return;
    }
    const response = await pool.query('select * from users where chat_id = $1', [ctx.chat.id]);
    if (response.rows.length) {
        await userMenu(ctx);
    } else return ctx.scene.enter('REGISTRATION_SCENE');
});

const adminActions = [
    { message: 'Боксы', scene: 'BOXES_SCENE' },
    { message: 'Услуги', scene: 'SERVICES_SCENE' },
    { message: 'Записи', scene: 'APPOINTMENTS_SCENE' },
    { message: 'Отчеты', scene: 'REPORT_SCENE' }
];
adminActions.forEach((action) => {
    bot.hears(action.message, async (ctx) => {
        if (store().get('admins').includes(ctx.chat.id)) {
            return ctx.scene.enter(action.scene);
        }
    });
});
const userActions = [
    { message: 'Профиль', scene: 'PROFILE_SCENE' },
    { message: 'История записей', scene: 'HISTORY_SCENE' },
    { message: 'Записаться', scene: 'SIGN_UP_SCENE' },
];
userActions.forEach((action) => {
    bot.hears(action.message, async (ctx) => {
        if (!store().get('admins').includes(ctx.chat.id)) {
            return ctx.scene.enter(action.scene);
        }
    });
});

bot.launch(async () => {
    store().put('admins', await reloadAdmins());
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));