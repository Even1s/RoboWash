const { Scenes, Markup } = require("telegraf");
const pool = require('../db');
const { adminMenu, editInlineKeyboard, getRowsArray} = require("../shared");

const ServicesScene = new Scenes.BaseScene('SERVICES_SCENE',)

ServicesScene.enter(async (ctx) => {
    await ctx.reply('Услуги:', {
        ...Markup.keyboard(['Создать', 'Назад']).resize()
    })
    const response = await pool.query('select * from services');
    const services = response.rows;

    const responseBoxes = await pool.query('select * from boxes');
    const boxes = responseBoxes.rows;

    const responseServicesInBoxes = await pool.query('select * from services_in_boxes');
    const servicesInBoxes = responseServicesInBoxes.rows;

    if (!services.length) {
        await ctx.reply('Услуг нет');
        return;
    }
    services.forEach((service, index) => {
        const currentBoxes = servicesInBoxes.filter((item) => item.service_id === service.service_id);
        let boxesText = currentBoxes.length ? 'Боксы:\n' : 'Боксы: Не выбраны';
        currentBoxes.forEach((item, index) => {
            const box = boxes.find((boxData) => boxData.box_id === item.box_id)
            boxesText += `${index+1}. ${box.box_name}\n`;
        })
        const serviceText = `${index+1}. ${service.service_name}\n` +
            `Описание: ${service.description ?? 'Нет'}\n` +
            `Продолжительность: ${service.duration}\n` +
            `Цена: ${service.service_cost}\n` +
            boxesText
        ctx.reply(serviceText, {
            ...Markup.inlineKeyboard([
                Markup.button.callback('Изменить', `edit-${service.service_id}`),
                Markup.button.callback('Удалить', `delete-${service.service_id}`)
            ])
        })
    });
})

ServicesScene.action(/^edit-(\d+)$/, (ctx) => {
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
            [Markup.button.callback('Изменить продолжительность', `edit-duration-${id}`)],
            [Markup.button.callback('Изменить цену', `edit-cost-${id}`)],
            [Markup.button.callback('Изменить боксы', `edit-boxes-${id}`)]
        ])
    });
});
ServicesScene.action(/^edit-name-(\d+)$/, async (ctx) => {
    ctx.session.editing.param = 'name';
    await editInlineKeyboard(ctx, [
        Markup.button.callback('Изменить', `edit-${ctx.session.editing.id}`),
        Markup.button.callback('Удалить', `delete-${ctx.session.editing.id}`)
    ]);
    await ctx.reply('Название услуги:', {
        ...Markup.keyboard(["Отмена"]).resize()
    });
});
ServicesScene.action(/^edit-description-(\d+)$/,  async (ctx) => {
    ctx.session.editing.param = 'description';
    await editInlineKeyboard(ctx, [
        Markup.button.callback('Изменить', `edit-${ctx.session.editing.id}`),
        Markup.button.callback('Удалить', `delete-${ctx.session.editing.id}`)
    ]);
    await ctx.reply('Описание услуги:', {
        ...Markup.keyboard(["Отмена"]).resize()
    });
});
ServicesScene.action(/^edit-duration-(\d+)$/, async (ctx) => {
    ctx.session.editing.param = 'duration';
    await editInlineKeyboard(ctx, [
        Markup.button.callback('Изменить', `edit-${ctx.session.editing.id}`),
        Markup.button.callback('Удалить', `delete-${ctx.session.editing.id}`)
    ]);
    await ctx.reply('Продолжительность (00:00):', {
        ...Markup.keyboard(["Отмена"]).resize()
    });
});
ServicesScene.action(/^edit-cost-(\d+)$/, async (ctx) => {
    ctx.session.editing.param = 'cost';
    await editInlineKeyboard(ctx, [
        Markup.button.callback('Изменить', `edit-${ctx.session.editing.id}`),
        Markup.button.callback('Удалить', `delete-${ctx.session.editing.id}`)
    ]);
    await ctx.reply('Цена:', {
        ...Markup.keyboard(["Отмена"]).resize()
    });
});
ServicesScene.action(/^edit-boxes-(\d+)$/, async (ctx) => {
    ctx.session.editing.param = 'boxes';
    await editInlineKeyboard(ctx, [
        Markup.button.callback('Изменить', `edit-${ctx.session.editing.id}`),
        Markup.button.callback('Удалить', `delete-${ctx.session.editing.id}`)
    ]);

    const response = await pool.query('select * from boxes');
    const boxes = response.rows;
    if (!boxes.length) {
        await ctx.reply('Боксов нет', {
            ...Markup.inlineKeyboard([Markup.button.callback(`Продолжить`, `next`)])
        });
        return ctx.wizard.next();
    }
    ctx.session.boxes = boxes;
    ctx.session.serviceBoxes = [];

    const boxesList = boxes.map((box, index) => `${index+1}. ${box.box_name}`);
    let callbacksList = [];
    boxes.forEach((box, index) => {
        callbacksList.push(Markup.button.callback(`${index+1}`, `add-boxes-${index}`));
    })
    callbacksList = getRowsArray(callbacksList)
    callbacksList.push([]);
    callbacksList[callbacksList.length-1].push(Markup.button.callback(`Продолжить`, `next`))

    await ctx.reply(
        'Выберите боксы:\n' + boxesList.join('\n'),
        {
            ...Markup.inlineKeyboard(callbacksList)
        }
    );
});
ServicesScene.action(/^add-boxes-(\d+)$/, async (ctx) => {
    const box = parseInt(ctx.match[1]);
    if (ctx.session.serviceBoxes.includes(box)) {
        const index = ctx.session.serviceBoxes.indexOf(box);
        ctx.session.serviceBoxes.splice(index, 1);
    } else {
        ctx.session.serviceBoxes.push(box);
    }

    let callbacksList = [];
    ctx.session.boxes.forEach((box, index) => {
        callbacksList.push(Markup.button.callback(
            ctx.session.serviceBoxes.includes(index) ? `✅${index+1}` : `${index+1}`,
            `add-boxes-${index}`));
    })
    callbacksList = getRowsArray(callbacksList);
    callbacksList.push([]);
    callbacksList[callbacksList.length-1].push(Markup.button.callback(`Продолжить`, `save-boxes`))

    await ctx.editMessageText(
        ctx.update.callback_query.message.text,
        {
            ...Markup.inlineKeyboard(callbacksList)
        }
    );
    return;
});
ServicesScene.action('save-boxes', async (ctx) => {
    const boxes = ctx.session.serviceBoxes.map((box) => ctx.session.boxes[box].box_id);
    await pool.query('delete from services_in_boxes where service_id = $1', [ctx.session.editing.id]);
    for (const box of boxes) {
        await pool.query('INSERT INTO services_in_boxes (service_id, box_id) VALUES ($1, $2);', [ctx.session.editing.id, box]);
    }

    ctx.session.editing = {
        param: null,
        id: null,
    };
    return ctx.scene.enter('SERVICES_SCENE');
});
ServicesScene.hears('Отмена', async (ctx) => {
    ctx.session.editing = {
        param: null,
        id: null,
    };
    await ctx.reply("Редактирование отменено", {
        ...Markup.keyboard(['Создать', 'Назад']).resize()
    })
});

ServicesScene.action(/^delete-(\d+)$/, (ctx) => {
    const id = ctx.match[1];
    ctx.editMessageText(ctx.update.callback_query.message.text, {
        ...Markup.inlineKeyboard([
            Markup.button.callback('Подтвердить удаление', `submit-delete-${id}`),
            Markup.button.callback('Отменить удаление', `reject-delete-${id}`)
        ])
    } );
});
ServicesScene.action(/^submit-delete-(\d+)$/, async (ctx) => {
    ctx.editMessageText('Удаленная услуга');
    await pool.query('delete from services_in_boxes where service_id = $1', [ctx.match[1]]);
    await pool.query('DELETE FROM services WHERE service_id = $1', [ctx.match[1]])
});
ServicesScene.action(/^reject-delete-(\d+)$/, async (ctx) => {
    await editInlineKeyboard(ctx, [
        Markup.button.callback('Изменить', `edit-${ctx.match[1]}`),
        Markup.button.callback('Удалить', `delete-${ctx.match[1]}`)
    ]);
})

ServicesScene.hears('Создать', (ctx) => {
    ctx.session.editing = {
        param: null,
        id: null,
    };
    return ctx.scene.enter('CREATE_SERVICE_SCENE')
});
ServicesScene.hears('Назад', async (ctx) => {
    ctx.session.editing = {
        param: null,
        id: null,
    };
    await adminMenu(ctx);
    return ctx.scene.leave();
});

ServicesScene.on('message', async (ctx) => {
    if (!ctx.session?.editing?.id || !ctx.session?.editing?.param) return;
    const value = ctx.message.text;
    switch (ctx.session.editing.param) {
        case 'name':
            await pool.query('update services set service_name = $1 where service_id = $2', [value, ctx.session.editing.id]);
            break;
        case 'description':
            await pool.query('update services set description = $1 where service_id = $2', [value, ctx.session.editing.id]);
            break;
        case 'duration':
            await pool.query('update services set duration = $1 where service_id = $2', [value, ctx.session.editing.id]);
            break;
        case 'cost':
            await pool.query('update services set service_cost = $1 where service_id = $2', [value, ctx.session.editing.id]);
            break;
    }
    ctx.session.editing = {
        param: null,
        id: null,
    };
    return ctx.scene.enter('SERVICES_SCENE');
})

module.exports = ServicesScene;