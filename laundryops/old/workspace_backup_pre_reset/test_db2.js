async function test() {
    const res = await fetch("https://tphagookafjldzvxaxui.supabase.co/rest/v1/invoices?select=*", {
        headers: {
            "apikey": "sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq",
            "Authorization": "Bearer sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq"
        }
    });
    const json = await res.json();
    console.log("Invoices:", JSON.stringify(json, null, 2));
}
test();
