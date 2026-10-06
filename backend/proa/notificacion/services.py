from datetime import datetime, timezone

from bson.objectid import ObjectId
from bson.errors import InvalidId
from rest_framework.exceptions import ValidationError

from core.roles import ROL_ESTUDIANTE, ROL_PROFESOR, es_admin, obtener_persona_y_rol

from .mongo import COLECCION_NOTIFICACION, obtener_coleccion

# El catálogo admite singular y plural; TODOS y AMBOS alcanzan a profesores y estudiantes
ALCANCES_ESTUDIANTE = ['ESTUDIANTE', 'ESTUDIANTES', 'TODOS', 'AMBOS']
ALCANCES_PROFESOR = ['PROFESOR', 'PROFESORES', 'TODOS', 'AMBOS']

PAGE_SIZE_POR_DEFECTO = 20
PAGE_SIZE_MAXIMO = 50
LIMITE_SIN_PAGINAR = 100
LIMITE_SIN_PAGINAR_MAXIMO = 200


def _coleccion():
    return obtener_coleccion(COLECCION_NOTIFICACION)


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
        return dirigido_a_el

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
    return {'$or': [dirigido_a_el, *ramas]}


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
        ahora = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M')
        sin_limite = [None, '']
        condiciones.append({'$or': [{'fecha_desde': {'$in': sin_limite}}, {'fecha_desde': {'$lte': ahora}}]})
        condiciones.append({'$or': [{'fecha_hasta': {'$in': sin_limite}}, {'fecha_hasta': {'$gte': ahora}}]})
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
    """Inserta el aviso. El autor sale de la sesión. Devuelve (id, documento)."""
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
    }
    resultado = _coleccion().insert_one(doc)
    return resultado.inserted_id, doc


def actualizar(obj_id, datos: dict) -> bool:
    """Actualiza solo los campos enviados. False si el aviso no existe."""
    if not datos:
        return _coleccion().count_documents({'_id': obj_id}) > 0
    return _coleccion().update_one({'_id': obj_id}, {'$set': datos}).matched_count > 0


def eliminar(obj_id) -> bool:
    return _coleccion().delete_one({'_id': obj_id}).deleted_count > 0
