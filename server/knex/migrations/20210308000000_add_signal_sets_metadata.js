exports.up = (knex, Promise) => (async () => {
    await knex.schema.table('signal_sets', table => {
        // this should be JSON, but it doesn't exist in MariaDB running on our server
        // table.json('metadata');
        table.text('metadata', 'longtext');
    });
})();

exports.down = (knex, Promise) => (async () => {
});