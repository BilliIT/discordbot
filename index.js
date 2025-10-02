// index.js - Bot completo Roblox + Fortnite (final)
const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    Events, 
    AttachmentBuilder, 
    Partials 
} = require('discord.js');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel]
});

client.once('ready', () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
});

// Estado temporal por canal (ticket)
let userStates = {};

/**
 * Respond safe:
 * - si la interacción no fue respondida: usa update() si es una actualización de mensaje (cuando viene de botón en mensaje existente),
 *   o reply() si opciones.indicateReply === true.
 * - si ya fue respondida/deferred: followUp()
 *
 * Para simplificar: si options.useReply === true -> reply (si no respondido)
 * else -> update (si no respondido)
 */
async function respond(interaction, options = {}) {
    // options: { content, components, files, ephemeral, useReply }
    try {
        if (interaction.replied || interaction.deferred) {
            return await interaction.followUp(options);
        } else {
            if (options.useReply) {
                return await interaction.reply(options);
            } else {
                // update edits original message (buttons). Works when interaction originates from a component
                return await interaction.update(options);
            }
        }
    } catch (err) {
        // Fallback: try reply if update failed
        try {
            if (!interaction.replied) return await interaction.reply({ content: options.content || " ", components: options.components || [], files: options.files || [], ephemeral: options.ephemeral });
        } catch (err2) {
            console.error("respond fallback error:", err2);
        }
    }
}

// Helper que envía método de pago y botones "ya envié" + "volver"
async function sendPaymentMessage(targetInteractionOrMessage, moneda, precio, filePath = null) {
    const components = [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ya_envie_comprobante').setLabel('✅ Ya envié comprobante').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('volver_opciones').setLabel('🔙 Volver a opciones').setStyle(ButtonStyle.Secondary)
        )
    ];

    let content = '';
    let files = [];

    if (moneda === 'cop') {
        content = `💰 Precio: **${Number(precio).toLocaleString()} COP**\n\n🇨🇴 Método de pago: **Nequi**\nNombre: Italo Billi\nNúmero: +573145705012\nCC: 1110285830\n\n⚠️ **No olvides enviar el comprobante.**`;
        if (filePath) files.push(new AttachmentBuilder(filePath));
    } else if (moneda === 'usdt') {
        content = `💰 Precio: **${Number(precio).toFixed(2)} USDT**\n\n💲 Método de pago: **Binance**\nCuenta/Email: italobilli25@gmail.com\n\n⚠️ **No olvides enviar el comprobante.**`;
    } else if (moneda === 'mxn') {
        content = `💰 Precio: **${precio} MXN**\n\n🇲🇽 Métodos de pago:\n🏦 Transferencia (BBVA)\nCuenta CLABE: 012 180 01532490899 8\n\n💳 Depósito (Tarjeta): 4152 3143 9482 6906\nBeneficiario: María Guzmán\n\n⚠️ **No olvides enviar el comprobante.**`;
    } else {
        content = `💰 Precio: **${precio}**\n\n⚠️ No se reconoce la moneda.`;
    }

    // Si target es Interaction -> respond(), si es Message -> message.reply()
    if (targetInteractionOrMessage && targetInteractionOrMessage.isButton) {
        // It's a ButtonInteraction
        await respond(targetInteractionOrMessage, { content, components, files, ephemeral: false, useReply: true });
    } else if (targetInteractionOrMessage && targetInteractionOrMessage.reply) {
        // It's a Message or interaction-like - reply
        await targetInteractionOrMessage.reply({ content, components, files, ephemeral: false });
    } else {
        console.error("sendPaymentMessage: target desconocido");
    }
}

// Precios fijos Club Fortnite
const clubPrices = {
    cop: { '1': 20000, '3': 40000, '6': 60000 },
    usdt: { '1': 4.8, '3': 9.6, '6': 14.4 },
    mxn: { '1': 112, '3': 203, '6': 294 }
};

// Precios MXN Robux (botones)
const mxnRobuxOptions = {
    "mxn_500": { robux: 500, precio: 104 },
    "mxn_1000": { robux: 1000, precio: 180 },
    "mxn_2000": { robux: 2000, precio: 340 },
    "mxn_5000": { robux: 5000, precio: 818 },
    "mxn_10000": { robux: 10000, precio: 1570 },
};

// Cuando se crea un canal ticket-
client.on(Events.ChannelCreate, async channel => {
    if (channel.type === 0 && channel.name.startsWith("ticket-")) {
        console.log("Ticket creado:", channel.name);
        setTimeout(async () => {
            try {
                await channel.guild.members.fetch();
                const clientUser = channel.members.filter(m => !m.user.bot).first()?.user;
                if (clientUser) userStates[channel.id] = { userId: clientUser.id };

                const mention = clientUser ? `<@${clientUser.id}>` : "👤 Cliente";

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('roblox').setLabel('💎 Roblox').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('fortnite').setLabel('🎮 Fortnite').setStyle(ButtonStyle.Success)
                );

                await channel.send({
                    content: `👋 Hola ${mention}, bienvenido a la tienda de Billi.\nIndícame en lo que estás interesado`,
                    components: [row]
                });
            } catch (err) {
                console.error("Error al saludar en ticket:", err);
            }
        }, 2000);
    }
});

// Manejo de Interacciones (botones)
client.on(Events.InteractionCreate, async interaction => {
    try {
        if (!interaction.isButton()) return;
        if (!interaction.channel || !interaction.channel.name || !interaction.channel.name.startsWith("ticket-")) return;

        const channelId = interaction.channel.id;
        const userId = interaction.user.id;

        // ---------- ROBLOX FLOW ----------
        if (interaction.customId === 'roblox') {
            return await respond(interaction, {
                content: "Explicación de cómo funciona el método de game pass:\nhttps://youtu.be/F90ZWXrzww4\n\nTérminos y condiciones (Obligatorio leer):\nhttps://www.notion.so/T-RMINOS-Y-CONDICIONES-DE-Billi_IT-2739088536a480819d0cc5c64451ee5c?source=copy_link\n\n¿Aceptas los términos y condiciones?",
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('aceptar_terminos').setLabel('✅ Acepto').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('rechazar_terminos').setLabel('❌ No acepto').setStyle(ButtonStyle.Danger)
                    )
                ],
                useReply: true
            });
        }

        if (interaction.customId === 'aceptar_terminos') {
            return await interaction.update({
                content: "Antes de continuar, ¿sabes crear un Game Pass?",
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('sabe_gamepass').setLabel('✅ Sí').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('no_sabe_gamepass').setLabel('❌ No').setStyle(ButtonStyle.Danger)
                    )
                ]
            });
        }

        if (interaction.customId === 'rechazar_terminos') {
            return await interaction.update({ content: "⚠️ Debes aceptar los términos y condiciones para continuar.", components: [] });
        }

        if (interaction.customId === 'sabe_gamepass') {
            return await interaction.update({
                content: "¡Perfecto! Ahora selecciona la moneda en la que quieres ver precios:",
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('moneda_cop').setLabel('🇨🇴 Pesos Colombianos').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('moneda_mxn').setLabel('🇲🇽 Pesos Mexicanos').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId('moneda_usdt').setLabel('💲 USDT').setStyle(ButtonStyle.Success)
                    )
                ]
            });
        }

        if (interaction.customId === 'no_sabe_gamepass') {
            return await interaction.update({
                content: "No te preocupes, aquí tienes tutoriales:\n\n**Cómo crear game pass en celular:**\nhttps://youtu.be/M-ez-xwRHYM\n\n**Cómo crear game pass en PC:**\nhttps://www.youtube.com/watch?v=3wjI-wr7iKo\n\nAhora selecciona la moneda en la que quieres ver precios:",
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('moneda_cop').setLabel('🇨🇴 Pesos Colombianos').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('moneda_mxn').setLabel('🇲🇽 Pesos Mexicanos').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId('moneda_usdt').setLabel('💲 USDT').setStyle(ButtonStyle.Success)
                    )
                ]
            });
        }

        // Moneda seleccionada (Roblox)
        if (interaction.customId.startsWith('moneda_')) {
            const moneda = interaction.customId.split('_')[1];
            // guardamos por usuario (para cuando escriba cantidad)
            userStates[userId] = { moneda };
            if (moneda === 'cop' || moneda === 'usdt') {
                // pedimos cantidad por mensaje
                return await respond(interaction, { content: `Has seleccionado **${moneda.toUpperCase()}**.\n¿Cuántos robux quieres? (mínimo 8)`, ephemeral: true, useReply: true });
            } else if (moneda === 'mxn') {
                // mostramos botones fijos
                return await interaction.update({
                    content: `📌 Precios disponibles en **MXN**:\n\n500 Robux = 104 MXN\n1,000 Robux = 180 MXN\n2,000 Robux = 340 MXN\n5,000 Robux = 818 MXN\n10,000 Robux = 1,570 MXN\n\nSi deseas una cantidad específica, presiona "Esperar vendedor".`,
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('mxn_500').setLabel('500 Robux').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('mxn_1000').setLabel('1000 Robux').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('mxn_2000').setLabel('2000 Robux').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('mxn_5000').setLabel('5000 Robux').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('mxn_10000').setLabel('10000 Robux').setStyle(ButtonStyle.Secondary)
                        ),
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('esperar_vendedor').setLabel('⏳ Esperar vendedor').setStyle(ButtonStyle.Primary)
                        )
                    ]
                });
            }
        }

        // Opciones MXN (Robux botones)
        if (interaction.customId.startsWith('mxn_')) {
            const opt = mxnRobuxOptions[interaction.customId];
            if (!opt) return await respond(interaction, { content: "Opción inválida.", useReply: true });
            // guardamos en estado del usuario
            userStates[userId] = { moneda: 'mxn', robux: opt.robux, precio: opt.precio };
            // mostramos precio + métodos de pago MXN
            return await respond(interaction, {
                content: `💰 El precio de **${opt.robux} Robux** es **${opt.precio} MXN**.\n\n🏦 Métodos de pago:\nTransferencia (BBVA) - Cuenta CLABE: 012 180 01532490899 8\nDepósito - Tarjeta: 4152 3143 9482 6906\nBeneficiario: María Guzmán\n\n⚠️ No olvides enviar el comprobante.`,
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('ya_envie_comprobante').setLabel('✅ Ya envié comprobante').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('reiniciar').setLabel('🔄 Cambiar cantidad/moneda').setStyle(ButtonStyle.Secondary)
                    )
                ],
                useReply: true
            });
        }

        // Esperar vendedor (MXN cantidad específica)
        if (interaction.customId === 'esperar_vendedor') {
            const cliente = userStates[channelId]?.userId ? `<@${userStates[channelId].userId}>` : "Cliente";
            // Notificamos (seguimos el flujo simple)
            return await respond(interaction, { content: `⏳ Un vendedor ha sido notificado para atender a ${cliente}`, useReply: true });
        }

        // Botón "pagar" para Robux (se usará tras cálculo por mensaje)
        if (interaction.customId === 'pagar') {
            const datos = userStates[userId];
            if (!datos) return await respond(interaction, { content: "⚠️ No encontré tus datos, vuelve a empezar.", useReply: true });
            // enviamos método de pago según moneda y recordatorio
            if (datos.moneda === 'cop') {
                const file = new AttachmentBuilder("C:\\Users\\italo\\Desktop\\MiBotDiscord\\imagenes\\Nequi italo.jpg");
                return await respond(interaction, {
                    content: `🇨🇴 Método de pago: Nequi\nNombre: Italo Billi\nNúmero: +573145705012\nCC: 1110285830\n\n⚠️ No olvides enviar el comprobante.`,
                    files: [file],
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('ya_envie_comprobante').setLabel('✅ Ya envié comprobante').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('reiniciar').setLabel('🔄 Cambiar cantidad/moneda').setStyle(ButtonStyle.Secondary)
                        )
                    ],
                    useReply: true
                });
            } else if (datos.moneda === 'usdt') {
                return await respond(interaction, {
                    content: `💲 Método de pago (USDT): Binance\nCuenta/Email: italobilli25@gmail.com\n\n⚠️ No olvides enviar el comprobante.`,
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('ya_envie_comprobante').setLabel('✅ Ya envié comprobante').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('reiniciar').setLabel('🔄 Cambiar cantidad/moneda').setStyle(ButtonStyle.Secondary)
                        )
                    ],
                    useReply: true
                });
            } else if (datos.moneda === 'mxn') {
                return await respond(interaction, {
                    content: `🇲🇽 Métodos de pago:\n🏦 Transferencia (BBVA) - CLABE: 012 180 01532490899 8\n💳 Depósito - Tarjeta: 4152 3143 9482 6906\nBeneficiario: María Guzmán\n\n⚠️ No olvides enviar el comprobante.`,
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('ya_envie_comprobante').setLabel('✅ Ya envié comprobante').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('reiniciar').setLabel('🔄 Cambiar cantidad/moneda').setStyle(ButtonStyle.Secondary)
                        )
                    ],
                    useReply: true
                });
            } else {
                return await respond(interaction, { content: "Moneda desconocida.", useReply: true });
            }
        }

        // Reiniciar / volver a opciones
        if (interaction.customId === 'reiniciar' || interaction.customId === 'volver_opciones') {
            // limpiamos estado
            delete userStates[userId];
            return await respond(interaction, {
                content: "🔄 Volvamos a empezar. Selecciona la opción:",
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('roblox').setLabel('💎 Roblox').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('fortnite').setLabel('🎮 Fortnite').setStyle(ButtonStyle.Success)
                    )
                ],
                useReply: true
            });
        }

        // Ya envió comprobante (notificar vendedor o marcar)
        if (interaction.customId === 'ya_envie_comprobante' || interaction.customId === 'ya_envie_comprobante') {
            // Si quieres etiquetar vendedor real, reemplaza ID_VENDEDOR por el ID real: `<@ID_VENDEDOR>`
            const vendedorMention = '@billi_it'; // <- Reemplaza por el ID real si quieres
            const clienteMention = userStates[channelId]?.userId ? `<@${userStates[channelId].userId}>` : `<@${userId}>`;
            await respond(interaction, {
                content: `✅ ${clienteMention} ha enviado el comprobante. ${vendedorMention}, por favor procede a verificar.`,
                useReply: true
            });
        }

        // ---------- FORTNITE FLOW ----------
        if (interaction.customId === 'fortnite') {
            return await interaction.update({
                content: "Selecciona la opción de Fortnite:",
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('metodo_regalo').setLabel('🎁 Método Regalo').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('club_fortnite').setLabel('👑 Club Fortnite').setStyle(ButtonStyle.Success)
                    )
                ]
            });
        }

        if (interaction.customId === 'metodo_regalo') {
            return await interaction.update({
                content: "Por el momento no tenemos stock. En enero tendremos 300k pavos disponibles.",
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('fortnite').setLabel('🔙 Volver').setStyle(ButtonStyle.Secondary)
                    )
                ]
            });
        }

        // CLUB FORTNITE: Pregunta si sabe método de recarga
        if (interaction.customId === 'club_fortnite') {
            return await interaction.update({
                content: "¿Sabes cómo funciona el método de recarga del Club Fortnite?",
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('club_sabe_si').setLabel('✅ Sí').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('club_sabe_no').setLabel('❌ No').setStyle(ButtonStyle.Danger)
                    )
                ]
            });
        }

        if (interaction.customId === 'club_sabe_no') {
            return await interaction.update({
                content: "Para recargar Club Fortnite necesitas tener tu cuenta Xbox vinculada a tu cuenta Epic.\n\n¿Sabes cómo vincularla?",
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('club_vincula_si').setLabel('✅ Sí').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('club_vincula_no').setLabel('❌ No').setStyle(ButtonStyle.Danger)
                    )
                ]
            });
        }

        if (interaction.customId === 'club_vincula_no') {
            return await interaction.update({
                content: "Mira este tutorial para vincular tu cuenta:\nhttps://www.youtube.com/watch?v=djY76t_zhes&t=4s\n\nCuando lo hagas, presiona 'Listo'.",
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('club_vincula_listo').setLabel('✅ Listo').setStyle(ButtonStyle.Success)
                    )
                ]
            });
        }

        if (interaction.customId === 'club_vincula_listo' || interaction.customId === 'club_vincula_si' || interaction.customId === 'club_sabe_si') {
            // Mostrar selección de moneda para Club Fortnite
            return await interaction.update({
                content: "Selecciona la moneda para ver los planes del Club Fortnite:",
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('club_moneda_cop').setLabel('🇨🇴 COP').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('club_moneda_usdt').setLabel('💲 USDT').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('club_moneda_mxn').setLabel('🇲🇽 MXN').setStyle(ButtonStyle.Danger)
                    )
                ]
            });
        }

        // Al seleccionar moneda para Club Fortnite, mostramos botones 1/3/6 meses
        if (interaction.customId.startsWith('club_moneda_')) {
            const moneda = interaction.customId.split('_')[2]; // cop | usdt | mxn
            // Guardamos estado simple
            userStates[userId] = { clubMoneda: moneda };

            return await interaction.update({
                content: `Planes Club Fortnite (${moneda.toUpperCase()}):`,
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`club_plan_${moneda}_1`).setLabel('1 mes').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId(`club_plan_${moneda}_3`).setLabel('3 meses').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId(`club_plan_${moneda}_6`).setLabel('6 meses').setStyle(ButtonStyle.Primary)
                    ),
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('fortnite').setLabel('🔙 Volver').setStyle(ButtonStyle.Secondary)
                    )
                ]
            });
        }

        // Planes Club Fortnite (botones 1/3/6)
        if (interaction.customId.startsWith('club_plan_')) {
            // form: club_plan_<moneda>_<meses>
            const parts = interaction.customId.split('_');
            const moneda = parts[2];
            const meses = parts[3];

            const precio = clubPrices[moneda] ? clubPrices[moneda][meses] : null;
            if (!precio) return await respond(interaction, { content: "Plan no encontrado.", useReply: true });

            // enviamos método de pago + recordatorio + botones
            if (moneda === 'cop') {
                const archivo = "C:\\Users\\italo\\Desktop\\MiBotDiscord\\imagenes\\Nequi italo.jpg";
                // respond con followUp (useReply true) para evitar duplicated reply
                return await respond(interaction, {
                    content: `💰 Club Fortnite - ${meses} mes(es) = **${precio.toLocaleString()} COP**\nMétodo de pago: 📲 Nequi\nNombre: Italo Billi\nNúmero: +573145705012\n\n⚠️ No olvides enviar el comprobante.`,
                    files: [archivo] ? [new AttachmentBuilder(archivo)] : [],
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('ya_envie_comprobante').setLabel('✅ Ya envié comprobante').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('volver_opciones').setLabel('🔙 Volver a opciones').setStyle(ButtonStyle.Secondary)
                        )
                    ],
                    useReply: true
                });
            } else if (moneda === 'usdt') {
                return await respond(interaction, {
                    content: `💰 Club Fortnite - ${meses} mes(es) = **${precio} USDT**\nMétodo de pago: 📧 Binance: italobilli25@gmail.com\n\n⚠️ No olvides enviar el comprobante.`,
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('ya_envie_comprobante').setLabel('✅ Ya envié comprobante').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('volver_opciones').setLabel('🔙 Volver a opciones').setStyle(ButtonStyle.Secondary)
                        )
                    ],
                    useReply: true
                });
            } else if (moneda === 'mxn') {
                return await respond(interaction, {
                    content: `💰 Club Fortnite - ${meses} mes(es) = **${precio} MXN**\nMétodo de pago:\n🏦 Transferencia BBVA - CLABE: 012 180 01532490899 8\n💳 Depósito: 4152 3143 9482 6906 (María Guzmán)\n\n⚠️ No olvides enviar el comprobante.`,
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('ya_envie_comprobante').setLabel('✅ Ya envié comprobante').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('volver_opciones').setLabel('🔙 Volver a opciones').setStyle(ButtonStyle.Secondary)
                        )
                    ],
                    useReply: true
                });
            }
        }

        // Si llegamos aquí: no matched case; solo ack para prevenir errores
        // (pero normalmente todas las rutas están capturadas arriba)
        try { if (!interaction.replied) await interaction.deferUpdate(); } catch (err) {}
    } catch (err) {
        console.error("Error en InteractionCreate:", err);
        // intenta notificar en la interacción si es posible
        try {
            if (interaction && interaction.isButton && !interaction.replied) {
                await interaction.followUp({ content: "❌ Ocurrió un error interno. Intenta de nuevo.", ephemeral: true });
            }
        } catch (e) {}
    }
});

// Mensajes (cuando usuario escribe cantidad para robux COP/USDT)
client.on(Events.MessageCreate, async message => {
    try {
        if (message.author.bot) return;
        if (!message.channel || !message.channel.name || !message.channel.name.startsWith("ticket-")) return;

        const userId = message.author.id;
        const datos = userStates[userId];
        if (!datos) return; // no hay moneda seleccionada

        if (datos.moneda === 'cop' || datos.moneda === 'usdt') {
            const robux = parseInt(message.content);
            if (isNaN(robux) || robux < 8) return message.reply("⚠️ Ingresa una cantidad válida de robux (mínimo 8).");

            let precio;
            if (datos.moneda === 'cop') {
                if (robux >= 10000) precio = robux * 33;
                else if (robux >= 1000) precio = robux * 34;
                else precio = robux * 35;

                userStates[userId].robux = robux;
                userStates[userId].precio = precio;

                const file = new AttachmentBuilder("C:\\Users\\italo\\Desktop\\MiBotDiscord\\imagenes\\Nequi italo.jpg");
                await message.reply({
                    content: `💰 El precio de **${robux} Robux** es **${precio.toLocaleString()} COP**.\n\nMétodo de pago: Nequi\nNo olvides enviar el comprobante.`,
                    files: [file],
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('pagar').setLabel('💳 Ver método de pago').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('reiniciar').setLabel('🔄 Cambiar cantidad/moneda').setStyle(ButtonStyle.Secondary)
                        )
                    ]
                });
            } else if (datos.moneda === 'usdt') {
                if (robux >= 10000) precio = robux * 0.00815;
                else if (robux >= 1000) precio = robux * 0.0084;
                else precio = robux * 0.009;

                userStates[userId].robux = robux;
                userStates[userId].precio = precio;

                await message.reply({
                    content: `💰 El precio de **${robux} Robux** es **${precio.toFixed(2)} USDT**.\n\nMétodo de pago: Binance\nNo olvides enviar el comprobante.`,
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('pagar').setLabel('💳 Ver método de pago').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('reiniciar').setLabel('🔄 Cambiar cantidad/moneda').setStyle(ButtonStyle.Secondary)
                        )
                    ]
                });
            }
        }
    } catch (err) {
        console.error("Error en MessageCreate:", err);
    }
});

client.login("MTQyMzA2MDU0MzkyNDYwMDgzMg.GNrfqo.ltuoe5BG2AI6ZFKwFZ4xGF_sYm5jXuEbPyeQQI");

// =============================
// AQUÍ VA TODO TU CÓDIGO DEL BOT
// (Tickets, botones, Roblox, Fortnite, etc.)
// =============================

// Login del bot
client.login(process.env.TOKEN);

// =========================
// SERVIDOR EXPRESS PARA UPTIMEROBOT / RENDER
// =========================
const express = require("express");
const app = express();

// Render usa la variable PORT, si no existe usamos 3000
const PORT = process.env.PORT || 3000;

// Ruta principal
app.get("/", (req, res) => {
  res.send("✅ El bot de Discord está activo y funcionando.");
});

// Inicia el servidor web
app.listen(PORT, () => {
  console.log(`🌍 Servidor Express corriendo en el puerto ${PORT}`);
});
