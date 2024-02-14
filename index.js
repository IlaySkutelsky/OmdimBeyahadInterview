const { Telegraf } = require('telegraf')
const { message } = require('telegraf/filters');
const GoogleSheetsService = require('./GoogleSheetsService.js');

// Helper function for getting the Authorization object from service
function getAuth() {
    return GoogleSheetsService.authorize()
}
// Helper function for better control of messages flow and timing
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Keep multiple states so ,ultiple chats can happen simultaneously
const ChatStates = {}

// Constant texts that are used in more then one loaction
const HelpText = ` אפשר לעבור בין האפשרויות השונות שלי באמצעות שליחת מספר:
    1 => כדי להוסיף אירוע חדש
    2 => כדי להוסיף שמות פעילים.ות לאירוע קיים`
const AddNamesText = `אפשר להזין את שמות הפעילות והפעילים כל שם בהודעה נפרדת או באותה הודעה מופרדים בפסיקים. לדוגמה:
סמא חסן, ליאל מגן, אבי-רם צורף, מרואן אל־מועשר

לסיום הוספת השמות יש לשלוח את המספר 0
`

async function main() {
    // Start
    const bot = new Telegraf(process.env.BOT_TOKEN)
    bot.start(initMessage)
    await sleep(100)
    // Define help function
    bot.help((ctx) => ctx.reply(HelpText))

    // General message call back
    bot.on(message('text'), async (ctx) => {
        if (!ChatStates[userIDFromCtx(ctx)] || !ChatStates[userIDFromCtx(ctx)].currentAction) initMessage(ctx)
        else {
            let msgText = ctx.update.message.text
            // State machine
            switch (ChatStates[userIDFromCtx(ctx)].currentAction) {
                case 'init':
                    if (msgText == '1') newEventMessage(ctx)
                    else if (msgText == '2') existingEventMessage(ctx)
                    else unknownInputMessage(ctx)
                    break;
                case 'newEvent':
                    newEventNameMessage(ctx)
                    break;
                case 'eventDate':
                    newEventDateMessage(ctx)
                    break;
                case 'chooseEvent':
                    existingEventChoseMessage(ctx)
                    break;
                case 'addName':
                    if (msgText == '0') endAddingNamesMsg(ctx)
                    else addName(ctx)
                    break;
                default:
                    break;
            }
        }
    });
    bot.launch()

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'))
    process.once('SIGTERM', () => bot.stop('SIGTERM'))
}

async function initMessage(ctx) {
    ctx.reply('היי! אני הבוט שאחראי על מעקב הפעילים.ות והאירועים של עומדים ביחד!')
    await sleep(100);
    ctx.reply(HelpText)
    ChatStates[userIDFromCtx(ctx)] = {
        currentAction: 'init',
        name: ctx.update.message.from.first_name + ' ' + ctx.update.message.from.last_name + ' - ' + ctx.update.message.from.username
    }
}

function newEventMessage(ctx) {
    ctx.reply('שם האירוע: ')
    ChatStates[userIDFromCtx(ctx)].currentAction = 'newEvent'
}

function newEventNameMessage(ctx) {
    let eventName = ctx.update.message.text
    ctx.reply('תאריך האירוע:')
    ChatStates[userIDFromCtx(ctx)].eventName = eventName
    ChatStates[userIDFromCtx(ctx)].currentAction = 'eventDate'
}

function newEventDateMessage(ctx) {
    let eventDate = ctx.update.message.text
    getAuth().then(async (auth) => {
        let eventName = ChatStates[userIDFromCtx(ctx)].eventName
        await GoogleSheetsService.addEvent(auth, eventName, eventDate)
        ctx.reply('האירוע נוסף לרשימת האירועים')
        await sleep(100);
        ctx.reply(AddNamesText)
        ChatStates[userIDFromCtx(ctx)].currentAction = 'addName'
    })
}

function existingEventMessage(ctx) {
    getAuth().then(async (auth) => {
        let events = await GoogleSheetsService.getEvents(auth)
        ctx.reply('רשימת האירועים הקיימים: ')
        await sleep(200);
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            ctx.reply((i+1) + '. ' + event)
            await sleep(200);
        }
        ctx.reply('לבחירת אירוע יש לשלוח את מספרו')
        ChatStates[userIDFromCtx(ctx)].currentAction = 'chooseEvent'
    })
}

function existingEventChoseMessage(ctx) {
    getAuth().then(async (auth) => {
        let events = await GoogleSheetsService.getEvents(auth)
        events = events.flat()
        let msgText = Number(ctx.update.message.text)
        if (isNaN(msgText) || !events[msgText - 1]) ctx.reply('לא נבחר מספר אירוע מתאים, יש לנסות שוב')
        else {
            let eventName = events[msgText - 1]
            ctx.reply('האירוע נבחר')
            await sleep(100);
            ctx.reply(AddNamesText)
            ChatStates[userIDFromCtx(ctx)].eventName = eventName
            ChatStates[userIDFromCtx(ctx)].currentAction = 'addName'
        }
    })
}

function addName(ctx) {
    let msgText = ctx.update.message.text
    let names = msgText.split(',').map(n => n.trim()).filter(n => !!n)
    getAuth().then(async (auth) => {
        GoogleSheetsService.addNames(auth, names, ChatStates[userIDFromCtx(ctx)].eventName)
    })
}

async function endAddingNamesMsg(ctx) {
    ctx.reply('תודה!')
    await sleep(100)
    ctx.reply('לחזרה להתחלה יש לשלוח הודעה נוספת')
    delete ChatStates[userIDFromCtx(ctx)]
}

function unknownInputMessage(ctx) {
    ctx.reply('תגובה לא זוהתה, יש לנסות שנית')
}

function userIDFromCtx(ctx) {
    return ctx.update.message.from.id
}

main()
