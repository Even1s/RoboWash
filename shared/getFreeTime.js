const generateTimeIntervals = require("./generateTimeIntervals");

const countTimeIntervals = (time) => {
    const [hours, minutes] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    return totalMinutes / 15;
}
const addTime = (start, duration) => {
    let time = new Date(start);
    time = new Date(time.getTime() + (15 * 60000 * countTimeIntervals(duration)));
    const hours = time.getHours().toString().padStart(2, '0');
    const minutes = time.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

module.exports = (appointments = [], start, end, duration = '00:15') => {
    const appointmentsTime = appointments.map(appointment => {
        const start = new Date(appointment.date);
        start.setDate(0);
        start.setMonth(0);
        start.setFullYear(0);
        const startHours = start.getHours().toString().padStart(2, '0');
        const startMinutes = start.getMinutes().toString().padStart(2, '0');
        const end = new Date(`1970-01-01T${addTime(appointment.date, appointment.duration)}`)
        const endHours = end.getHours().toString().padStart(2, '0');
        const endMinutes = end.getMinutes().toString().padStart(2, '0');
        return { start: `${startHours}:${startMinutes}`, end: `${endHours}:${endMinutes}` };
    });
    const intervals = generateTimeIntervals(start, end);

    appointmentsTime.forEach((appointment) => {
        const appointmentIntervals = generateTimeIntervals(appointment.start, appointment.end)
        appointmentIntervals.forEach((interval) => {
            const index = intervals.indexOf(interval);
            if (index >= 0)
                intervals.splice(index, 1);
        })
    });

    const acceptedIntervals = [];
    intervals.forEach((interval, i, array) => {
        const durationIntervals = [];
        for (let j = i; j < i + countTimeIntervals(duration); j++)
            durationIntervals.push(array[j]);

        if (durationIntervals.length === 1)
            acceptedIntervals.push(interval)

        for (let j = 1; j < durationIntervals.length; j++)
            if (countTimeIntervals(durationIntervals[j] ?? '00:00') - countTimeIntervals(durationIntervals[j-1]) === 1)
                acceptedIntervals.push(interval)
    });

    return acceptedIntervals;
}