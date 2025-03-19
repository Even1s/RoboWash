module.exports = (startTime, endTime) => {
    const intervals = [];
    const start = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);

    if (end < start)
        end.setDate(end.getDate() + 1);

    let currentTime = start;

    while (currentTime < end) {
        const hours = currentTime.getHours().toString().padStart(2, '0');
        const minutes = currentTime.getMinutes().toString().padStart(2, '0');
        intervals.push(`${hours}:${minutes}`);
        currentTime = new Date(currentTime.getTime() + 15 * 60000);
    }

    return intervals;
}