const {Markup} = require("telegraf");

module.exports = async (ctx) => {
    await ctx.reply(
        'Меню Администратора\n' +
        '1. Боксы\n' +
        '2. Услуги\n' +
        '3. Записи\n' +
        '4. Отчеты'
        , {...Markup.keyboard([
            "Боксы",
            "Услуги",
            "Записи",
            "Отчеты"
        ]).resize()
    });
}