const {Scenes, Markup} = require("telegraf");
const { adminMenu, getRowsArray } = require("../shared");
const pool = require("../db");


module.exports = new Scenes.WizardScene(
    'CREATE_SERVICE_SCENE',
    async (ctx) => {
        await ctx.reply('Название услуги:', {...Markup.removeKeyboard(true)});
        ctx.wizard.state.service = {};
        return ctx.wizard.next();
    },
    async (ctx) => {
        ctx.wizard.state.service.name = ctx.message.text;
        await ctx.reply('Описание:');
        return ctx.wizard.next();
    },
    async (ctx) => {
        ctx.wizard.state.service.description = ctx.message.text;
        await ctx.reply('Цена:');
        return ctx.wizard.next();
    },
    async (ctx) => {
        ctx.wizard.state.service.cost = ctx.message.text;
        await ctx.reply('Продолжительность (00:00):');
        return ctx.wizard.next();
    },
    async (ctx) => {
        ctx.wizard.state.service.duration = ctx.message.text;

        const response = await pool.query('select * from boxes');
        const boxes = response.rows;
        if (!boxes.length) {
            await ctx.reply('Боксов нет', {
                ...Markup.inlineKeyboard([Markup.button.callback(`Продолжить`, `next`)])
            });
            return ctx.wizard.next();
        }
        ctx.wizard.state.boxes = boxes;
        ctx.wizard.state.service.boxes = [];

        const boxesList = boxes.map((box, index) => `${index+1}. ${box.box_name}`);
        let callbacksList = [];
        boxes.forEach((box, index) => {
            callbacksList.push(Markup.button.callback(`${index+1}`, `add-${index}`));
        })
        callbacksList = getRowsArray(callbacksList);
        callbacksList.push([]);
        callbacksList[callbacksList.length-1].push(Markup.button.callback(`Продолжить`, `next`))

        await ctx.reply(
            'Выберите боксы:\n' + boxesList.join('\n'),
            {
                ...Markup.inlineKeyboard(callbacksList)
            }
        );
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (ctx.message?.text) {
            return;
        } else if (ctx.callbackQuery?.data === 'next') {
            const boxes = ctx.wizard.state.service.boxes.map((box) =>
                `${box+1}. ${ctx.wizard.state.boxes[box].box_name}`
            );
            await ctx.reply(
                `Данные верны?\n\n` +
                `Название: ${ctx.wizard.state.service.name}\n` +
                `Описание: ${ctx.wizard.state.service.description}\n` +
                `Цена: ${ctx.wizard.state.service.cost}\n` +
                `Продолжительность: ${ctx.wizard.state.service.duration ?? 'Нет'}\n` +
                `Боксы: ${boxes.length ? '\n' + boxes.join('\n') : 'Не выбраны'}`
                , {
                    ...Markup.keyboard(["Да", "Нет", "Отмена"]).resize()
                });
            return ctx.wizard.next();
        } else {
            const box = parseInt(ctx.callbackQuery.data.substring(4));
            if (ctx.wizard.state.service.boxes.includes(box)) {
                const index = ctx.wizard.state.service.boxes.indexOf(box);
                ctx.wizard.state.service.boxes.splice(index, 1);
            } else {
                ctx.wizard.state.service.boxes.push(box);
            }

            let callbacksList = [];
            ctx.wizard.state.boxes.forEach((box, index) => {
                callbacksList.push(Markup.button.callback(
                    ctx.wizard.state.service.boxes.includes(index) ? `✅${index+1}` : `${index+1}`,
                    `add-${index}`));
            });
            callbacksList = getRowsArray(callbacksList);
            callbacksList.push([]);
            callbacksList[callbacksList.length-1].push(Markup.button.callback(`Продолжить`, `next`));

            await ctx.editMessageText(
                ctx.update.callback_query.message.text,
                {
                    ...Markup.inlineKeyboard(callbacksList)
                }
            );
            return;
        }
    },
    async (ctx) => {
        const command = ctx.message.text;
        if (command === "Нет") {
            await ctx.reply('Название услуги:', {...Markup.removeKeyboard(true)});
            ctx.wizard.state.service = {};
            return ctx.wizard.selectStep(1);
        } else if (command === 'Да') {
            const service = ctx.wizard.state.service;
            const response = await pool.query(
                'INSERT INTO services (service_name, description, service_cost, duration) VALUES ($1, $2, $3, $4) returning service_id;',
                [service.name, service.description, service.cost, service.duration],
            )
            if (ctx.wizard.state.boxes) {
                const boxes = ctx.wizard.state.service.boxes.map((box) => ctx.wizard.state.boxes[box].box_id);
                boxes.forEach((box) => {
                    pool.query('INSERT INTO services_in_boxes (service_id, box_id) VALUES ($1, $2);', [response.rows[0].service_id, box])
                })
            }
            await ctx.reply('Успешно', {...Markup.removeKeyboard(true)});
            return ctx.scene.enter('SERVICES_SCENE');
        } else if (command === 'Отмена') {
            await adminMenu(ctx);
            return ctx.scene.leave();
        } else return;
    }
)