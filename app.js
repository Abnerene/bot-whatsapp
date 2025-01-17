/**
 * ⚡⚡⚡ DECLARAMOS LAS LIBRERIAS y CONSTANTES A USAR! ⚡⚡⚡
 */

require('dotenv').config()
const fs = require('fs');
const express = require('express');
const cors = require('cors')
const qrcode = require('qrcode-terminal');
const { Client } = require('whatsapp-web.js');
const mysqlConnection = require('./config/mysql')
const { middlewareClient } = require('./middleware/client')
const { generateImage, cleanNumber, checkEnvFile, createClient, isValidNumber } = require('./controllers/handle')
const { connectionReady, connectionLost } = require('./controllers/connection')
const { saveMedia } = require('./controllers/save')
const { getMessages, responseMessages, bothResponse } = require('./controllers/flows')
const { sendMedia, sendMessage, lastTrigger, sendMessageButton, readChat } = require('./controllers/send')
const app = express();
app.use(cors())
app.use(express.json())
const MULTI_DEVICE = process.env.MULTI_DEVICE || 'true';
const server = require('http').Server(app)

const port = process.env.PORT || 3000
const SESSION_FILE_PATH = './session.json';
var client;
var sessionData;

app.use('/', require('./routes/web'))

/**
 * Escuchamos cuando entre un mensajesdsfefe
 */
const listenMessage = () => client.on('message', async msg => {
    const { from, body, hasMedia } = msg;
    console.log("este es el from",from);

    if(!isValidNumber(from)){
        return
    }

    // Este bug lo reporto Lucas Aldeco Brescia para evitar que se publiquen estados
    if (from === 'status@broadcast') {
        return
    }
    message = body.toLowerCase();
    console.log('BODY',message)
    const number = cleanNumber(from)
    await readChat(number, message)

    /**
     * Guardamos el archivo multimedia que envia
     */
    if (process.env.SAVE_MEDIA && hasMedia) {
        const media = await msg.downloadMedia();
        saveMedia(media);
    }

    /**
     * Si estas usando dialogflow solo manejamos una funcion todo es IA
     */

    if (process.env.DATABASE === 'dialogflow') {
        if(!message.length) return;
        const response = await bothResponse(message);
        await sendMessage(client, from, response.replyMessage);
        if (response.media) {
            sendMedia(client, from, response.media);
        }
        return
    }

    /**
    * Ver si viene de un paso anterior
    * Aqui podemos ir agregando más pasos
    * a tu gusto!
    */

    const lastStep = await lastTrigger(from) || null;
    if (lastStep) {
        const response = await responseMessages(lastStep)
        await sendMessage(client, from, response.replyMessage);
    }

    /**
     * Respondemos al primero paso si encuentra palabras clave
     */
    const step = await getMessages(message);

    if (step) {
        const response = await responseMessages(step);

        /**
         * Si quieres enviar botones
         */

        await sendMessage(client, from, response.replyMessage, response.trigger);

        if(response.hasOwnProperty('actions')){
            const { actions } = response;
            await sendMessageButton(client, from, null, actions);
            return
        }

        if (!response.delay && response.media) {
            sendMedia(client, from, response.media);
        }
        if (response.delay && response.media) {
            setTimeout(() => {
                sendMedia(client, from, response.media);
            }, response.delay)
        }
        return
    }

    //Si quieres tener un mensaje por defecto
    if (process.env.DEFAULT_MESSAGE === 'true') {
        const response = await responseMessages('DEFAULT')
        await sendMessage(client, from, response.replyMessage, response.trigger);

        /**
         * Si quieres enviar botones
         */
        if(response.hasOwnProperty('actions')){
            const { actions } = response;
            await sendMessageButton(client, from, null, actions);
        }
        return
    }
});

/**
 * Revisamos si tenemos credenciales guardadas para inciar sessio
 * este paso evita volver a escanear el QRCODE
 */
const withSession = () => {
    console.log(`Validando session con Whatsapp...`)
    sessionData = require(SESSION_FILE_PATH);
    client = new Client(createClient(sessionData,true));

    client.on('ready', () => {
        connectionReady()
        listenMessage()
    });

    client.on('auth_failure', () => connectionLost())

    client.initialize();
}

/**
 * Generamos un QRCODE para iniciar sesion
 */
const withOutSession = () => {
    console.log('No tenemos session guardada');
    console.log([
        '🙌 El core de whatsapp se esta actualizando',
        '🙌 para proximamente dar paso al multi-device',
        '🙌 falta poco si quieres estar al pendiente unete',
        '🙌 http://t.me/leifermendez',
        '🙌 Si estas usando el modo multi-device se generan 2 QR Code escanealos',
        '🙌 Ten paciencia se esta generando el QR CODE',
        '________________________',
    ].join('\n'));

    client = new Client(createClient());

    client.on('qr', qr => generateImage(qr, () => {
        qrcode.generate(qr, { small: true });
        console.log(`Ver QR http://localhost:${port}/qr`)
        socketEvents.sendQR(qr)
    }))
    client.on('ready', (a) => {
        connectionReady()
        listenMessage()
        // socketEvents.sendStatus(client)
    });

    client.on('auth_failure', (e) => {
        // console.log(e)
        // connectionLost()
    });

    client.on('authenticated', (session) => {
        console.log('Creo que se geenro el archivo');
        console.log(typeof(session));
        sessionData = session;
        if(sessionData){
            fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
                if (err) {
                    console.log("Ocurrio un error con el archivo: ", err);
                }
            });
        }
    });

    client.initialize();
}

/**
 * Revisamos si existe archivo con credenciales!
 */
(fs.existsSync(SESSION_FILE_PATH) && MULTI_DEVICE === 'false') ? withSession() : withOutSession();

/**
 * Verificamos si tienes un gesto de db
 */

if (process.env.DATABASE === 'mysql') {
    mysqlConnection.connect()
}

server.listen(port, () => {
    console.log(`El server esta listo por el puerto ${port}`);
})
checkEnvFile();


//APISSSSSS

const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.get('/nwhats',async (req,res)=>{


 const { phone, name, message, media } = req.body;
 if(message){
 sendMessage(client, phone, message);
 }
 if(media){
    console.log("mimedia",media);
    const { MessageMedia } = require('whatsapp-web.js');
    const myMedia = await MessageMedia.fromUrl(media);
    sendMessage(client, phone, myMedia);
    // console.log(media);
 }
 
 res.send(`welcome to my api${media}`);

});


const Pageres = require('pageres');

app.get('/sendtiket',async (req,res)=>{
    const { cliente,phone,url } = req.body;
    const timestamp = Date.now();
    const filename =timestamp+"-"+cliente;

    var dir='tiketes';
    var ruta=`https://photoleongraduaciones.com/tiketes/tiket?u=${cliente}`;
    await new Pageres({
        filename : filename,
        selector:'#canvas',
        format:'jpg'})
    .src(ruta,['1200x3300'])
    .dest('./tiketes')
    .run()
    
    const { MessageMedia } = require('whatsapp-web.js');
    var media = MessageMedia.fromFilePath(`./tiketes/${filename}.jpg`);
    
    sendMessage(client, phone, media)
    fs.unlinkSync(`./${dir}/${filename}.jpg`);
    res.send(`ok`);

});

app.get('/bienvenida',async (req,res)=>{ 
    const { cliente,phone,url } = req.body;
    const timestamp = Date.now();
    const filename =timestamp+"-"+cliente;
    var dir='tiketes';
    var ruta=`https://photoleongraduaciones.com/tiketes/bienvenida?u=${cliente}`;
    await new Pageres({
        filename : filename,
        selector:'#canvas',
        format:'jpg'})
    .src(ruta,['1200x3300'])
    .dest('./tiketes')
    .run()
    // const { MessageMedia } = require('whatsapp-web.js');
    // const myMedia = await MessageMedia.fromUrl(media);
    
    const { MessageMedia } = require('whatsapp-web.js');
    var media = MessageMedia.fromFilePath(`./tiketes/${filename}.jpg`);
    
    sendMessage(client, phone, media)
    setTimeout(() => {
    var media = MessageMedia.fromFilePath(`./recursos/descarga.jpg`);
    sendMessage(client, phone, media,{caption:'mensaje de prueba'})
    }, 3000);

    fs.unlinkSync(`./${dir}/${filename}.jpg`);
    
    setTimeout(() => {
        sendMessage(client, phone, '*📱 Descarga en Android*  photoleongraduaciones.com/app/android\n\n*📱 Descarga* en iPhone photoleongraduaciones.com/app/iphone'); 
    }, 6000);
    
    res.send(`ok`);

});

