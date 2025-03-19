const { Scenes, Markup } = require("telegraf");
const pool = require('../db');
const { adminMenu, editInlineKeyboard} = require("../shared");

const BoxesScene = new Scenes.BaseScene('BOXES_SCENE',)

BoxesScene.enter(async (ctx) => {
    await ctx.reply('Боксы:', {
        ...Markup.keyboard(['Создать', 'Назад']).resize()
    })
    const response = await pool.query('select * from boxes');
    const boxes = response.rows;
    if (!boxes.length) {
        await ctx.reply('Боксов нет');
        return;
    }
    boxes.forEach((box, index) => {
        const boxText = `${index+1}. ${box.box_name}\n` +
            `Описание: ${box.description ?? 'Нет'}\n` +
            `Начало работы: ${box.start_time}\n` +
            `Конец работы: ${box.end_time}\n`
        ctx.reply(boxText, {
            ...Markup.inlineKeyboard([
                Markup.button.callback('Изменить', `edit-${box.box_id}`),
                Markup.button.callback('Удалить', `delete-${box.box_id}`)
            ])
        })
    });
})

BoxesScene.action(/^edit-(\d+)$/, (ctx) => {
    if (ctx.session?.editing?.id) return;
    const id = ctx.match[1];
    ctx.session.editing = {
        param: null,
        id: id,
    };
    ctx.editMessageText(ctx.update.callback_query.message.text, {
        ...Markup.inlineKeyboard([
            [Markup.button.callback('Изменить название', `edit-name-${id}`)],
            [Markup.button.callback('Изменить описание', `edit-description-${id}`)],
            [Markup.button.callback('Изменить начало работы', `edit-start-${id}`)],
            [Markup.button.callback('Изменить конец работы', `edit-end-${id}`)]
        ])
    });
});
BoxesScene.action(/^edit-name-(\d+)$/, async (ctx) => {
    ctx.session.editing.param = 'name';
    await editInlineKeyboard(ctx, [
        Markup.button.callback('Изменить', `edit-${ctx.session.editing.id}`),
        Markup.button.callback('Удалить', `delete-${ctx.session.editing.id}`)
    ]);
    await ctx.reply('Название бокса:', {
        ...Markup.keyboard(["Отмена"]).resize()
    });
});
BoxesScene.action(/^edit-description-(\d+)$/,  async (ctx) => {
    ctx.session.editing.param = 'description';
    await editInlineKeyboard(ctx, [
        Markup.button.callback('Изменить', `edit-${ctx.session.editing.id}`),
        Markup.button.callback('Удалить', `delete-${ctx.session.editing.id}`)
    ]);
    await ctx.reply('Описание бокса:', {
        ...Markup.keyboard(["Отмена"]).resize()
    });
});
BoxesScene.action(/^edit-start-(\d+)$/, async (ctx) => {
    ctx.session.editing.param = 'start';
    await editInlineKeyboard(ctx, [
        Markup.button.callback('Изменить', `edit-${ctx.session.editing.id}`),
        Markup.button.callback('Удалить', `delete-${ctx.session.editing.id}`)
    ]);
    await ctx.reply('Начало работы (00:00):', {
        ...Markup.keyboard(["Отмена"]).resize()
    });
});
BoxesScene.action(/^edit-end-(\d+)$/, async (ctx) => {
    ctx.session.editing.param = 'end';
    await editInlineKeyboard(ctx, [
        Markup.button.callback('Изменить', `edit-${ctx.session.editing.id}`),
        Markup.button.callback('Удалить', `delete-${ctx.session.editing.id}`)
    ]);
    await ctx.reply('Конец работы (00:00):', {
        ...Markup.keyboard(["Отмена"]).resize()
    });
});
BoxesScene.hears('Отмена', async (ctx) => {
    ctx.session.editing = {
        param: null,
        id: null,
    };
    await ctx.reply("Редактирование отменено", {
        ...Markup.keyboard(['Создать', 'Назад']).resize()
    })
});

BoxesScene.action(/^delete-(\d+)$/, (ctx) => {
    const id = ctx.match[1];
    ctx.editMessageText(ctx.update.callback_query.message.text, {
        ...Markup.inlineKeyboard([
            Markup.button.callback('Подтвердить удаление', `submit-delete-${id}`),
            Markup.button.callback('Отменить удаление', `reject-delete-${id}`)
        ])
    });
});
BoxesScene.action(/^submit-delete-(\d+)$/, async (ctx) => {
    ctx.editMessageText('Удаленный бокс');
    await pool.query('DELETE FROM boxes WHERE box_id = $1', [ctx.match[1]])
});
BoxesScene.action(/^reject-delete-(\d+)$/, async (ctx) => {
    await editInlineKeyboard(ctx, [
        Markup.button.callback('Изменить', `edit-${ctx.match[1]}`),
        Markup.button.callback('Удалить', `delete-${ctx.match[1]}`)
    ]);
})

BoxesScene.hears('Создать', (ctx) => {
    ctx.session.editing = {
        param: null,
        id: null,
    };
    return ctx.scene.enter('CREATE_BOX_SCENE');
});
BoxesScene.hears('Назад', async (ctx) => {
    ctx.session.editing = {
        param: null,
        id: null,
    };
    await adminMenu(ctx);
    return ctx.scene.leave();
});

BoxesScene.on('message', async (ctx) => {
    if (!ctx.session?.editing?.id || !ctx.session?.editing?.param) return;
    const value = ctx.message.text;
    switch (ctx.session.editing.param) {
        case 'name':
            await pool.query('update boxes set box_name = $1 where box_id = $2', [value, ctx.session.editing.id]);
            break;
        case 'description':
            await pool.query('update boxes set description = $1 where box_id = $2', [value, ctx.session.editing.id]);
            break;
        case 'start':
            await pool.query('update boxes set start_time = $1 where box_id = $2', [value, ctx.session.editing.id]);
            break;
        case 'end':
            await pool.query('update boxes set end_time = $1 where box_id = $2', [value, ctx.session.editing.id]);
            break;
    }
    ctx.session.editing = {
        param: null,
        id: null,
    };
    return ctx.scene.enter('BOXES_SCENE');
})

module.exports = BoxesScene;