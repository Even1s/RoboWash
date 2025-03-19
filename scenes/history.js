const { Scenes, Markup } = require("telegraf");
const pool = require('../db');
const { adminMenu, editInlineKeyboard, getRowsArray, getFreeTime, userMenu} = require("../shared");

const HistoryScene = new Scenes.BaseScene('HISTORY_SCENE',)

HistoryScene.enter(async (ctx) => {
    await ctx.reply('Ваши записи:', {
        ...Markup.keyboard(['Записаться', 'Назад']).resize()
    })
    const response = await pool.query(
        'select * from appointments ' +
        'join boxes using (box_id) ' +
        'join services using (service_id) ' +
        'where user_id = $1',
        [ctx.chat.id]
    );
    const appointments = response.rows;
    if (!appointments.length) {
        await ctx.reply('Записей нет');
        return;
    }

    appointments.forEach((appointment, index) => {
        appointment.date = appointment.date.toLocaleString()
        const buttons = [
            Markup.button.callback('Перенести', `edit-time-${appointment.appointment_id}`),
            Markup.button.callback('Отменить', `delete-${appointment.appointment_id}`)
        ];
        const boxText = `${index+1}. ${appointment.service_name}\n` +
            `Бокс: ${appointment.box_name}\n` +
            `Время записи: ${appointment.date}\n` +
            `Продолжительность: ${appointment.duration}\n` +
            `Цена: ${appointment.service_cost}\n` +
            `Скидка: ${appointment.used_bonuses}\n` +
            `Сумма: ${Math.max((parseInt(appointment.service_cost) - appointment.used_bonuses), 0)} ` +
            `${appointment.service_cost.substring(appointment.service_cost.length-1)}\n` +
            `Статус: ${appointment.status}\n`
        ctx.reply(boxText, {
            ...Markup.inlineKeyboard(appointment.status === 'Отменена' ? [] : buttons)
        })
    });
})

HistoryScene.action(/^edit-time-(\d+)$/, async (ctx) => {
    if (ctx.session?.editing?.id) return;
    const id = ctx.match[1];
    ctx.session.editing = {
        param: 'time-1',
        id: id,
    };
    await ctx.reply('Дата (yyyy-mm-dd):', {
        ...Markup.keyboard(["Отмена"]).resize()
    });
    const response = await pool.query(
        'select * from appointments ' +
        'join boxes using (box_id) ' +
        'join services using (service_id) ' +
        'where appointment_id = $1',
        [ctx.session.editing.id]
    );
    ctx.session.appointment = response.rows[0];
    const buttons = [
        Markup.button.callback('Перенести', `edit-${ctx.session.appointment.appointment_id}`),
        Markup.button.callback('Отменить', `delete-${ctx.session.appointment.appointment_id}`)
    ]
    await editInlineKeyboard(ctx, ctx.session.appointment.status === 'Отменена' ? [] : buttons);
});

HistoryScene.hears('Отмена', async (ctx) => {
    if (!ctx.session.editing.id) return;
    ctx.session.editing = {
        param: null,
        id: null,
    };
    await ctx.reply("Редактирование отменено", {
        ...Markup.keyboard(['Записаться', 'Назад']).resize()
    })
});

HistoryScene.action(/^delete-(\d+)$/, (ctx) => {
    const id = ctx.match[1];
    ctx.session.editing = {
        param: null,
        id: id,
    };
    ctx.editMessageText(ctx.update.callback_query.message.text, {
        ...Markup.inlineKeyboard([
            Markup.button.callback('Подтвердить отмену', `submit-delete-${id}`),
            Markup.button.callback('Не отменять', `reject-delete-${id}`)
        ])
    });
});
HistoryScene.action(/^submit-delete-(\d+)$/, async (ctx) => {
    await pool.query('update appointments set status = $1 where appointment_id = $2', ["Отменена", ctx.session.editing.id]);
    return ctx.scene.enter('HISTORY_SCENE');
});
HistoryScene.action(/^reject-delete-(\d+)$/, async (ctx) => {
    await editInlineKeyboard(ctx, [
        Markup.button.callback('Перенести', `edit-${ctx.match[1]}`),
        Markup.button.callback('Отменить', `delete-${ctx.match[1]}`)
    ]);
})

HistoryScene.hears('Записаться', (ctx) => {
    ctx.session.editing = {
        param: null,
        id: null,
    };
    return ctx.scene.enter('SIGN_UP_SCENE');
});
HistoryScene.hears('Назад', async (ctx) => {
    ctx.session.editing = {
        param: null,
        id: null,
    };
    await userMenu(ctx);
    return ctx.scene.leave();
});

HistoryScene.on('message', async (ctx) => {
    if (!ctx.session?.editing?.id || !ctx.session?.editing?.param) return;
    const value = ctx.message.text;
    switch (ctx.session.editing.param) {
        case 'time-1': {
            const date = new Date(value);
            if (date < Date.now()) {
                await ctx.reply('Введите дату больше сегодняшней')
                return;
            }
            ctx.session.date = date;
            const responseAppointments = await pool.query(
                'select * from appointments ' +
                'join boxes using (box_id) ' +
                'join services using (service_id) ' +
                'where box_id = $1 ' +
                'and extract(year from date) = $2 ' +
                'and extract(month from date) = $3 ' +
                'and extract(day from date) = $4',
                [ctx.session.appointment.box_id, date.getFullYear(), date.getMonth() + 1, date.getDate()]
            );
            const appointments = responseAppointments.rows;

            const responseAppointment = await pool.query(
                'select * from appointments ' +
                'join boxes using (box_id) ' +
                'join services using (service_id) ' +
                'where appointment_id = $1',
                [ctx.session.editing.id]
            );
            const appointment = responseAppointment.rows[0];

            const freeTime = getFreeTime(
                appointments,
                appointment.start_time,
                appointment.end_time,
                appointment.duration
            );
            const timeButtons = getRowsArray(freeTime, 4);
            timeButtons.push(["Отмена"]);
            await ctx.reply('Время:', {
                ...Markup.keyboard(timeButtons).resize()
            });
            ctx.session.editing.param = 'time-2'
            return;
        } case 'time-2': {
            const date = ctx.session.date;
            const time = value.split(':').map(Number);
            date.setUTCHours(time[0], time[1], 0);
            if (date < Date.now()) {
                await ctx.reply('Введите дату больше сегодняшней')
                return;
            }
            ctx.session.date = date;
            ctx.session.date = ctx.session.date.toISOString().replace('T', ' ').split('.')[0];
            await pool.query(
                'update appointments set date = $1 where appointment_id = $2',
                [ctx.session.date, ctx.session.editing.id]);
            break;
        }
    }
    ctx.session.editing = {
        param: null,
        id: null,
    };
    await userMenu(ctx);
    return ctx.scene.leave();
})

module.exports = HistoryScene;