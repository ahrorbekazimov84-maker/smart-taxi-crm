import logging
from telegram import Update
from telegram.ext import (
    ApplicationBuilder, CommandHandler, MessageHandler, ContextTypes, ConversationHandler, filters
)

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)


from bot_config import TELEGRAM_BOT_TOKEN


# Conversation states
ISM, TEL, YONALISH = range(3)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        'Assalomu alaykum! Buyurtma berish uchun ismingizni kiriting:'
    )
    return ISM



async def ism_qabul(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['ism'] = update.message.text.strip()
    await update.message.reply_text('Telefon raqamingizni kiriting:')
    return TEL

async def tel_qabul(update: Update, context: ContextTypes.DEFAULT_TYPE):
    tel = update.message.text.strip()
    if not tel.startswith('+998') or len(tel) < 13:
        await update.message.reply_text("Telefon raqam +998 bilan boshlanishi va to'liq bo'lishi kerak!")
        return TEL
    context.user_data['tel'] = tel
    await update.message.reply_text("Yo'nalishni kiriting (masalan: Toshkent ➔ Andijon):")
    return YONALISH

async def yonalish_qabul(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['yonalish'] = update.message.text.strip()
    ism = context.user_data['ism']
    tel = context.user_data['tel']
    yonalish = context.user_data['yonalish']
    # Bu yerda buyurtmani admin yoki serverga yuborish logikasi bo'lishi mumkin
    await update.message.reply_text(
        f"Buyurtmangiz qabul qilindi!\n\nIsm: {ism}\nTel: {tel}\nYo'nalish: {yonalish}\n\nTez orada operatorlar bog'lanishadi."
    )
    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text('Buyurtma bekor qilindi.')
    return ConversationHandler.END


if __name__ == '__main__':
    app = ApplicationBuilder().token(TELEGRAM_BOT_TOKEN).build()
    conv_handler = ConversationHandler(
        entry_points=[CommandHandler('start', start)],
        states={
            ISM: [MessageHandler(filters.TEXT & ~filters.COMMAND, ism_qabul)],
            TEL: [MessageHandler(filters.TEXT & ~filters.COMMAND, tel_qabul)],
            YONALISH: [MessageHandler(filters.TEXT & ~filters.COMMAND, yonalish_qabul)],
        },
        fallbacks=[CommandHandler('cancel', cancel)]
    )
    app.add_handler(conv_handler)
    app.run_polling()
