module.exports = (array, count = 5) => {
    const rows = [];
    array.forEach((item, index) => {
        if (index % count === 0) rows.push([]);
        rows[Math.floor(index / count)].push(item);
    })
    return rows;
}