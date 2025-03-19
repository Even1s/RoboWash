const { Scenes, Markup } = require("telegraf");
const pool = require('../db');
const { adminMenu, editInlineKeyboard, getRowsArray, getFreeTime} = require("../shared");

const AppointmentsScene = new Scenes.BaseScene('APPOINTMENTS_SCENE',)

AppointmentsScene.enter(async (ctx) => {
    await ctx.reply('Записи:', {
        ...Markup.keyboard(['Создать', 'Назад']).resize()
    })
    const response = await pool.query(
        'select * from appointments ' +
        'join boxes using (box_id) ' +
        'join services using (service_id) ' +
        'left join users on user_id = chat_id'
    );
    const appointments = response.rows;
    if (!appointments.length) {
        await ctx.reply('Записей нет');
        return;
    }

    appointments.forEach((appointment, index) => {
        appointment.date = appointment.date.toLocaleString()
        const boxText = `${index+1}. ${appointment.service_name}\n` +
            `Бокс: ${appointment.box_name}\n` +
            (appointment.user_id ?
                `Клиент: ${appointment.last_name} ${appointment.first_name} ${appointment.patronymic} ${appointment.car_number}\n` :
                'Клиент: Нет\n') +
            `Время записи: ${appointment.date}\n` +
            `Продолжительность: ${appointment.duration}\n` +
            `Цена: ${appointment.service_cost}\n` +
            `Скидка: ${appointment.used_bonuses}\n` +
            `Сумма: ${Math.max((parseInt(appointment.service_cost) - appointment.used_bonuses), 0)} ` +
            `${appointment.service_cost.substring(appointment.service_cost.length-1)}\n` +
            `Статус: ${appointment.status}\n`
        ctx.reply(boxText, {
            ...Markup.inlineKeyboard([
                Markup.button.callback('Изменить', `edit-${appointment.appointment_id}`),
                Markup.button.callback('Удалить', `delete-${appointment.appointment_id}`)
            ])
        })
    });
})

AppointmentsScene.action(/^edit-(\d+)$/, (ctx) => {
    if (ctx.session?.editing?.id) return;
    const id = ctx.match[1];
    ctx.session.editing = {
        param: null,
        id: id,
    };
    ctx.editMessageText(ctx.update.callback_query.message.text, {
        ...Markup.inlineKeyboard([
            [Markup.button.callback('Перенести', `edit-time-${id}`)],
            [Markup.button.callback('Изменить статус', `edit-status-${id}`)]
        ])
    });
});
AppointmentsScene.action(/^edit-time-(\d+)$/, async (ctx) => {
    ctx.session.editing.param = 'time-1';
    await editInlineKeyboard(ctx, [
        Markup.button.callback('Изменить', `edit-${ctx.session.editing.id}`),
        Markup.button.callback('Удалить', `delete-${ctx.session.editing.id}`)
    ]);
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
});
AppointmentsScene.action(/^edit-status-(\d+)$/, async (ctx) => {
    ctx.session.editing.param = 'status';
    await editInlineKeyboard(ctx, [
        Markup.button.callback('Изменить', `edit-${ctx.session.editing.id}`),
        Markup.button.callback('Удалить', `delete-${ctx.session.editing.id}`)
    ]);
    await ctx.reply('Выберите статус:', {
        ...Markup.keyboard(["Запланирована", "В процессе", "Отменена", "Завершена"]).resize()
    });
});
AppointmentsScene.hears('Отмена', async (ctx) => {
    ctx.session.editing = {
        param: null,
        id: null,
    };
    await ctx.reply("Редактирование отменено", {
        ...Markup.keyboard(['Создать', 'Назад']).resize()
    })
});

AppointmentsScene.action(/^delete-(\d+)$/, (ctx) => {
    const id = ctx.match[1];
    ctx.editMessageText(ctx.update.callback_query.message.text, {
        ...Markup.inlineKeyboard([
            Markup.button.callback('Подтвердить удаление', `submit-delete-${id}`),
            Markup.button.callback('Отменить удаление', `reject-delete-${id}`)
        ])
    });
});
AppointmentsScene.action(/^submit-delete-(\d+)$/, async (ctx) => {
    ctx.editMessageText('Удаленный бокс');
    await pool.query('DELETE FROM appointments WHERE appointment_id = $1', [ctx.match[1]])
});
AppointmentsScene.action(/^reject-delete-(\d+)$/, async (ctx) => {
    await editInlineKeyboard(ctx, [
        Markup.button.callback('Изменить', `edit-${ctx.match[1]}`),
        Markup.button.callback('Удалить', `delete-${ctx.match[1]}`)
    ]);
})

AppointmentsScene.hears('Создать', (ctx) => {
    ctx.session.editing = {
        param: null,
        id: null,
    };
    return ctx.scene.enter('CREATE_APPOINTMENT_SCENE');
});
AppointmentsScene.hears('Назад', async (ctx) => {
    ctx.session.editing = {
        param: null,
        id: null,
    };
    await adminMenu(ctx);
    return ctx.scene.leave();
});

AppointmentsScene.on('message', async (ctx) => {
    if (!ctx.session?.editing?.id || !ctx.session?.editing?.param) return;
    const value = ctx.message.text;
    switch (ctx.session.editing.param) {
        case 'time-1':
            const date = new Date(value);
            if (date < Date.now()) {
                await ctx.reply('Введите дату больше сегодняшней')
                return ctx.wizard.back();
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
                [ctx.session.appointment.box_id, date.getFullYear(), date.getMonth()+1, date.getDate()]
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
        case 'time-2':
            const time = value.split(':').map(Number);
            ctx.session.date.setUTCHours(time[0], time[1], 0);
            ctx.session.date = ctx.session.date.toISOString().replace('T', ' ').split('.')[0];
            await pool.query(
                'update appointments set date = $1 where appointment_id = $2',
                [ctx.session.date, ctx.session.editing.id]);
            break;
        case 'status':
            await pool.query('update appointments set status = $1 where appointment_id = $2', [value, ctx.session.editing.id]);
            break;
    }
    ctx.session.editing = {
        param: null,
        id: null,
    };
    return ctx.scene.enter('APPOINTMENTS_SCENE');
})

module.exports = AppointmentsScene;