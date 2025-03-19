const {Markup} = require("telegraf");

module.exports = async (ctx) => {
    await ctx.reply(
        'Меню\n' +
        '1. Профиль\n' +
        '2. История записей\n' +
        '3. Записаться'
        , {...Markup.keyboard([
            "Профиль",
            "История записей",
            "Записаться"
        ]).resize()
    });
}