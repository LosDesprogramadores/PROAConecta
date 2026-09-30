from pymongo import MongoClient
from django.conf import settings

client = MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000)
db = client[settings.MONGO_DB_NAME]

notificaciones_collection = db['notificacion']
tipos_notificacion_collection = db['tipo_notificacion']