const {Scenes, Markup} = require("telegraf");
const { adminMenu } = require("../shared");
const pool = require("../db");


module.exports = new Scenes.WizardScene(
    'CREATE_BOX_SCENE',
     async (ctx) => {
        await ctx.reply('Название бокса:', {...Markup.removeKeyboard(true)});
        ctx.wizard.state.box = {};
        return ctx.wizard.next();
    },
    async (ctx) => {
        ctx.wizard.state.box.name = ctx.message.text;
        await ctx.reply('Описание:');
        return ctx.wizard.next();
    },
    async (ctx) => {
        ctx.wizard.state.box.description = ctx.message.text;
        await ctx.reply('Начало работы (00:00):');
        return ctx.wizard.next();
    },
    async (ctx) => {
        ctx.wizard.state.box.start = ctx.message.text;
        await ctx.reply('Конец работы (00:00):');
        return ctx.wizard.next();
    },
    async (ctx) => {
        ctx.wizard.state.box.end = ctx.message.text;
        const box = ctx.wizard.state.box;
        await ctx.reply(
            `Данные верны?\n\n` +
            `Название: ${box.name}\n` +
            `Описание: ${box.description}\n` +
            `Начало работы: ${box.start ?? 'Нет'}\n` +
            `Конец работы: ${box.end}\n`
            , {
                ...Markup.keyboard(["Да", "Нет", "Отмена"]).resize()
            });
        return ctx.wizard.next();
    },
    async (ctx) => {
        const command = ctx.message.text;
        if (command === "Нет") {
            await ctx.reply('Название бокса:', {...Markup.removeKeyboard(true)});
            ctx.wizard.state.box = {};
            return ctx.wizard.selectStep(1);
        } else if (command === 'Да') {
            const box = ctx.wizard.state.box;
            await pool.query(
                'INSERT INTO boxes(box_name, description, start_time, end_time) VALUES ($1, $2, $3, $4);',
                [box.name, box.description, box.start, box.end],
            )
            await ctx.reply('Успешно', {...Markup.removeKeyboard(true)});
            return ctx.scene.enter('BOXES_SCENE');
        } else if (command === 'Отмена') {
            await adminMenu(ctx);
            return ctx.scene.leave();
        } else return;
    }
)