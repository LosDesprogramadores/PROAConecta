import os
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

# Obtener variables de entorno pasadas al contenedor Docker
MONGO_URI = os.getenv("DATABASE_URL_MONGODB")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "proa_conecta")

db = None

if MONGO_URI:
    try:
        # Inicializa el cliente global nativo de PyMongo
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        db = client[MONGO_DB_NAME]
        
        # Verificación rápida de conexión en la consola al iniciar el contenedor
        client.admin.command('ping')
        print("🍃 Conectado exitosamente a MongoDB Atlas")
    except ConnectionFailure:
        print("❌ Error: No se pudo conectar a MongoDB Atlas. Verificá tu red, credenciales o IP Access.")
else:
    print("⚠️ Advertencia: DATABASE_URL_MONGODB no está definida en las variables de entorno.")
