import logging
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from bson.objectid import ObjectId
from bson.errors import InvalidId
from rest_framework.exceptions import ValidationError

from core.roles import ROL_ESTUDIANTE, ROL_PROFESOR, es_admin, obtener_persona_y_rol

from .mongo import COLECCION_NOTIFICACION, obtener_coleccion
from .tiempo_real import grupo_materia_rol, grupo_rol, grupo_usuario, publicar

logger = logging.getLogger(__name__)

ZONA_HORARIA = ZoneInfo('America/Argentina/Buenos_Aires')
ESTADO_PROGRAMADA = 'PROGRAMADA'
ESTADO_VIGENTE = 'VIGENTE'
ESTADO_VENCIDA = 'VENCIDA'

# El catálogo admite singular y plural; TODOS y AMBOS alcanzan a profesores y estudiantes
ALCANCES_ESTUDIANTE = ['ESTUDIANTE', 'ESTUDIANTES', 'TODOS', 'AMBOS']
ALCANCES_PROFESOR = ['PROFESOR', 'PROFESORES', 'TODOS', 'AMBOS']

PAGE_SIZE_POR_DEFECTO = 20
PAGE_SIZE_MAXIMO = 50
LIMITE_SIN_PAGINAR = 100
LIMITE_SIN_PAGINAR_MAXIMO = 200


def _coleccion():
    return obtener_coleccion(COLECCION_NOTIFICACION)


def hoy() -> date:
    """El día de hoy en Buenos Aires: las fechas de vigencia son días, no instantes UTC."""
    return datetime.now(ZONA_HORARIA).date()


def _dia(valor):
    """Día (AAAA-MM-DD) de una fecha guardada como texto, con o sin hora. None si está vacía."""
    texto = _como_texto(valor)
    return texto[:10] if texto else None


def _filtro_vigencia() -> dict:
    # Texto ISO: 'AAAA-MM-DDThh:mm' es mayor que 'AAAA-MM-DD' del mismo día, por eso el desde se compara
    # contra el día siguiente (exclusivo) y el hasta contra hoy (inclusivo)
    dia = hoy()
    manana = (dia + timedelta(days=1)).isoformat()
    sin_limite = [None, '']
    return {'$and': [
        {'$or': [{'fecha_desde': {'$in': sin_limite}}, {'fecha_desde': {'$lt': manana}}]},
        {'$or': [{'fecha_hasta': {'$in': sin_limite}}, {'fecha_hasta': {'$gte': dia.isoformat()}}]},
    ]}


def estado_vigencia(doc) -> str:
    dia = hoy().isoformat()
    desde, hasta = _dia(doc.get('fecha_desde')), _dia(doc.get('fecha_hasta'))
    if desde and desde > dia:
        return ESTADO_PROGRAMADA
    if hasta and hasta < dia:
        return ESTADO_VENCIDA
    return ESTADO_VIGENTE


def objectid_o_none(valor):
    try:
        return ObjectId(valor)
    except (InvalidId, TypeError):
        return None


def _materias_del_usuario(persona, rol):
    from academico.models import Materia
    from academico.selectors import materias_con_acceso

    if persona is None:
        return []
    if rol == ROL_PROFESOR:
        return list(Materia.objects.filter(profesor=persona).values_list('id', flat=True))
    if rol == ROL_ESTUDIANTE:
        # materias_con_acceso excluye BAJA; LIBRE sigue siendo parte de la materia
        return list(materias_con_acceso(persona).values_list('id', flat=True))
    return []


def filtro_visibilidad(user) -> dict:
    """Filtro Mongo con lo que el usuario puede ver. El administrador ve todo."""
    if es_admin(user):
        return {}

    persona, rol = obtener_persona_y_rol(user)
    dirigido_a_el = {'usuario_destino_id': user.pk}
    if rol not in (ROL_PROFESOR, ROL_ESTUDIANTE):
        return {'$and': [dirigido_a_el, _filtro_vigencia()]}

    alcances = ALCANCES_PROFESOR if rol == ROL_PROFESOR else ALCANCES_ESTUDIANTE
    # Un aviso sin alcance se trata como AMBOS
    por_alcance = {'$or': [{'alcance': {'$in': alcances}}, {'alcance': {'$exists': False}}]}
    materias = _materias_del_usuario(persona, rol)

    ramas = [{'$and': [por_alcance, {'materia_id': None}]}]
    if materias:
        if rol == ROL_PROFESOR:
            # El titular recibe todo lo de sus materias
            ramas.append({'materia_id': {'$in': materias}})
        else:
            ramas.append({'$and': [por_alcance, {'materia_id': {'$in': materias}}]})
    return {'$and': [{'$or': [dirigido_a_el, *ramas]}, _filtro_vigencia()]}


def _entero(params, nombre):
    valor = params.get(nombre)
    if valor in (None, ''):
        return None
    try:
        return int(valor)
    except (TypeError, ValueError):
        raise ValidationError({nombre: ['Debe ser un número entero.']})


def _filtros_de_consulta(user, params) -> dict:
    condiciones = [filtro_visibilidad(user)]
    materia_id = _entero(params, 'materia_id')
    if materia_id is not None:
        condiciones.append({'materia_id': materia_id})
    tipo = params.get('tipo')
    if tipo:
        condiciones.append({'tipo_notificacion_codigo': tipo})
    if str(params.get('no_leidas', '')).lower() == 'true':
        condiciones.append({'leida_por': {'$ne': user.pk}})
    if str(params.get('vigentes', '')).lower() == 'true':
        condiciones.append(_filtro_vigencia())
    if str(params.get('propias', '')).lower() == 'true':
        # Los avisos antiguos sin autor quedan fuera
        condiciones.append({'usuario_origen_id': user.pk})
    condiciones = [c for c in condiciones if c]
    if not condiciones:
        return {}
    return condiciones[0] if len(condiciones) == 1 else {'$and': condiciones}


def _como_texto(valor):
    if valor in (None, ''):
        return None
    return valor.isoformat() if isinstance(valor, datetime) else str(valor)


def _serializar(docs, user):
    from academico.models import Materia
    from usuario.models import Usuario

    materias = dict(Materia.objects.filter(
        id__in={d['materia_id'] for d in docs if d.get('materia_id') is not None}
    ).values_list('id', 'titulo'))
    autores = {
        u.pk: f'{u.persona.apellido}, {u.persona.nombre}'
        for u in Usuario.objects.filter(
            pk__in={d['usuario_origen_id'] for d in docs if d.get('usuario_origen_id') is not None},
            persona__isnull=False,
        ).select_related('persona')
    }
    return [{
        'id': str(d['_id']),
        'titulo': d.get('titulo', 'Aviso'),
        'mensaje': d.get('mensaje'),
        'tipo_notificacion_codigo': d.get('tipo_notificacion_codigo', 'GENERAL'),
        'alcance': d.get('alcance', 'AMBOS'),
        'materia_id': d.get('materia_id'),
        'materia_nombre': materias.get(d.get('materia_id')),
        'autor': autores.get(d.get('usuario_origen_id')),
        'fecha_desde': _como_texto(d.get('fecha_desde')),
        'fecha_hasta': _como_texto(d.get('fecha_hasta')),
        'fecha_creacion': _como_texto(d.get('fecha_creacion')),
        'estado_vigencia': estado_vigencia(d),
        'leida': user.pk in d.get('leida_por', []),
    } for d in docs]


def serializar_por_id(user, obj_id):
    """El aviso con el mismo formato de un elemento de ``listar`` (se relee de Mongo para que las
    fechas salgan igual que en el listado)."""
    doc = _coleccion().find_one({'_id': obj_id})
    return _serializar([doc], user)[0] if doc else None


def serializar_documento(user, doc):
    """Formato de un elemento de ``listar`` para un documento ya en memoria."""
    return _serializar([doc], user)[0]


def listar(user, params, ruta):
    """Lista los avisos visibles. Sin ``page``/``page_size`` devuelve un arreglo acotado por ``limit``;
    con ellos, el sobre paginado del contrato."""
    filtro = _filtros_de_consulta(user, params)
    cursor = _coleccion().find(filtro).sort([('fecha_creacion', -1), ('_id', -1)])

    if 'page' not in params and 'page_size' not in params:
        limite = _entero(params, 'limit') or LIMITE_SIN_PAGINAR
        limite = max(1, min(limite, LIMITE_SIN_PAGINAR_MAXIMO))
        return _serializar(list(cursor.limit(limite)), user)

    pagina = max(1, _entero(params, 'page') or 1)
    tamano = max(1, min(_entero(params, 'page_size') or PAGE_SIZE_POR_DEFECTO, PAGE_SIZE_MAXIMO))
    total = _coleccion().count_documents(filtro)
    docs = list(cursor.skip((pagina - 1) * tamano).limit(tamano))
    base = {k: v for k, v in params.items() if k != 'page'}

    def _enlace(n):
        from urllib.parse import urlencode
        return f'{ruta}?{urlencode({**base, "page": n})}'

    return {
        'count': total,
        'next': _enlace(pagina + 1) if pagina * tamano < total else None,
        'previous': _enlace(pagina - 1) if pagina > 1 else None,
        'results': _serializar(docs, user),
        'no_leidas': _coleccion().count_documents(
            {'$and': [filtro, {'leida_por': {'$ne': user.pk}}]} if filtro else {'leida_por': {'$ne': user.pk}}
        ),
    }


def marcar_leida(user, obj_id) -> bool:
    """Marca el aviso como leído solo para ``user``. False si no existe o no le es visible."""
    filtro = {'$and': [{'_id': obj_id}, filtro_visibilidad(user)]} if filtro_visibilidad(user) else {'_id': obj_id}
    if _coleccion().find_one(filtro, {'_id': 1}) is None:
        return False
    _coleccion().update_one({'_id': obj_id}, {'$addToSet': {'leida_por': user.pk}})
    return True


def crear(user, datos: dict):
    """Inserta el aviso. El autor sale de la sesión. Devuelve (id, documento). Si su fecha de inicio es
    futura queda con ``push_pendiente`` para que lo publique ``publicar_notificaciones_programadas``."""
    doc = {
        'tipo_notificacion_codigo': datos['tipo_notificacion_codigo'],
        'usuario_destino_id': datos.get('usuario_destino_id') or user.pk,
        'usuario_origen_id': user.pk,
        'titulo': datos['titulo'],
        'mensaje': datos['mensaje'],
        'leida_por': [],
        'fecha_creacion': datetime.now(timezone.utc),
        'fecha_desde': datos.get('fecha_desde'),
        'fecha_hasta': datos.get('fecha_hasta'),
        'referencia_tipo': None,
        'referencia_id': None,
        'alcance': datos['alcance'],
        'materia_id': datos.get('materia_id'),
        'push_pendiente': estado_vigencia({'fecha_desde': datos.get('fecha_desde')}) == ESTADO_PROGRAMADA,
    }
    resultado = _coleccion().insert_one(doc)
    return resultado.inserted_id, doc


def actualizar(obj_id, datos: dict) -> bool:
    """Actualiza solo los campos enviados. False si el aviso no existe.

    Si cambia la fecha de inicio se recalcula el envío: futura deja el aviso pendiente; de hoy, pasada o
    vacía lo publica ya si seguía pendiente (una sola vez) y baja la marca."""
    actual = _coleccion().find_one({'_id': obj_id})
    if actual is None:
        return False
    if not datos:
        return True

    _validar_rango({c: datos[c] if c in datos else actual.get(c) for c in ('fecha_desde', 'fecha_hasta')})
    cambia_inicio = 'fecha_desde' in datos
    if cambia_inicio and estado_vigencia({'fecha_desde': datos['fecha_desde']}) == ESTADO_PROGRAMADA:
        datos = {**datos, 'push_pendiente': True}
        cambia_inicio = False
    if _coleccion().update_one({'_id': obj_id}, {'$set': datos}).matched_count == 0:
        return False

    if cambia_inicio and actual.get('push_pendiente'):
        _publicar_ahora(obj_id)
    return True


def _validar_rango(fechas: dict) -> None:
    desde, hasta = _dia(fechas['fecha_desde']), _dia(fechas['fecha_hasta'])
    if desde and hasta and hasta < desde:
        raise ValidationError({'fecha_hasta': ['No puede ser anterior a la fecha de inicio.']})


def _publicar_ahora(obj_id) -> None:
    """Publica un aviso que seguía pendiente y cuya fecha ya llegó. Si venció, solo baja la marca; si el
    canal falla, la devuelve para que la recoja el comando periódico."""
    doc = reclamar(obj_id)
    if doc is None:
        descartar_vencidos()
        return
    try:
        publicar_aviso(obj_id, doc)
    except Exception:
        devolver_marca(obj_id)
        logger.warning('No se pudo publicar el aviso editado %s; lo reintenta el programador', obj_id, exc_info=True)


def eliminar(obj_id) -> bool:
    return _coleccion().delete_one({'_id': obj_id}).deleted_count > 0


def grupos_de_publicacion(doc) -> list:
    """Grupos de tiempo real que deben recibir el aviso: los roles del alcance dentro de la materia si es de
    una materia; si no, los roles del alcance y el usuario destinatario (por defecto, el administrador)."""
    alcance = doc.get('alcance', 'AMBOS')
    roles = []
    if alcance in ALCANCES_PROFESOR:
        roles.append(ROL_PROFESOR)
    if alcance in ALCANCES_ESTUDIANTE:
        roles.append(ROL_ESTUDIANTE)
    if doc.get('materia_id') is not None:
        # Solo los miembros de la materia con ese rol (el consumer los une al conectar); el titular recibe
        # siempre todo lo de su materia, como en el listado
        roles_materia = roles if ROL_PROFESOR in roles else [ROL_PROFESOR, *roles]
        return [grupo_materia_rol(doc['materia_id'], rol) for rol in roles_materia]
    grupos = [grupo_rol(rol) for rol in roles]
    if doc.get('usuario_destino_id') is not None:
        grupos.append(grupo_usuario(doc['usuario_destino_id']))
    return grupos


def publicar_aviso(obj_id, doc) -> None:
    """Envía el aviso en vivo a sus grupos. Propaga el error si el canal falla: quien llama decide."""
    aviso = {
        'id': str(obj_id),
        'titulo': doc['titulo'],
        'mensaje': doc['mensaje'],
        'tipo_notificacion_codigo': doc.get('tipo_notificacion_codigo', 'GENERAL'),
        'alcance': doc.get('alcance', 'AMBOS'),
        'fecha_desde': _como_texto(doc.get('fecha_desde')) or '',
        'fecha_hasta': _como_texto(doc.get('fecha_hasta')) or '',
        'estado_vigencia': estado_vigencia(doc),
        'materia_id': doc.get('materia_id'),
        'leida': False,
    }
    for grupo in grupos_de_publicacion(doc):
        publicar(grupo, 'notificacion.creada', aviso)


def _filtro_pendientes() -> dict:
    """Pendientes cuya fecha de inicio ya llegó y que no vencieron (sin fecha de fin o con fin >= hoy)."""
    dia = hoy()
    manana = (dia + timedelta(days=1)).isoformat()
    sin_limite = [None, '']
    return {
        'push_pendiente': True,
        '$and': [
            {'$or': [{'fecha_desde': {'$in': sin_limite}}, {'fecha_desde': {'$lt': manana}}]},
            {'$or': [{'fecha_hasta': {'$in': sin_limite}}, {'fecha_hasta': {'$gte': dia.isoformat()}}]},
        ],
    }


def descartar_vencidos() -> int:
    """Baja la marca de los pendientes cuya vigencia ya terminó: no se publican avisos vencidos."""
    filtro = {'push_pendiente': True, 'fecha_hasta': {'$nin': [None, ''], '$lt': hoy().isoformat()}}
    return _coleccion().update_many(filtro, {'$set': {'push_pendiente': False}}).modified_count


def pendientes_de_publicar() -> list:
    """Ids de los avisos con envío pendiente cuya fecha de inicio ya llegó y que siguen vigentes."""
    return [d['_id'] for d in _coleccion().find(_filtro_pendientes(), {'_id': 1})]


def reclamar(obj_id):
    """Baja la marca de forma atómica. Devuelve el documento solo a quien la bajó (dos ejecuciones
    simultáneas no publican dos veces) y None si otra ya lo reclamó, fue eliminado o venció."""
    return _coleccion().find_one_and_update({'_id': obj_id, **_filtro_pendientes()}, {'$set': {'push_pendiente': False}})


def devolver_marca(obj_id) -> None:
    _coleccion().update_one({'_id': obj_id}, {'$set': {'push_pendiente': True}})
