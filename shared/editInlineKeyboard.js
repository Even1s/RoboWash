const {Markup} = require("telegraf");

module.exports = async (ctx, keyboard) => {
    ctx.editMessageText(ctx.update.callback_query.message.text, {
        ...Markup.inlineKeyboard(keyboard)
    })
}