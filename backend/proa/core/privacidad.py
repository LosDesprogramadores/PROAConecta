from .roles import es_admin


class PrivacidadPersonaMixin:
    """Serializer de persona por audiencia.

    Administrador y la propia persona ven todos los campos; el resto solo ``campos_publicos``.
    Sin request en el contexto se aplica la vista pública (denegar por defecto).
    """

    campos_publicos = ()

    def _ve_todo(self, persona):
        request = self.context.get('request')
        usuario = getattr(request, 'user', None)
        if usuario is None or not getattr(usuario, 'is_authenticated', False):
            return False
        return es_admin(usuario) or getattr(usuario, 'persona_id', None) == persona.pk

    def to_representation(self, instance):
        datos = super().to_representation(instance)
        if self._ve_todo(instance):
            return datos
        return {campo: valor for campo, valor in datos.items() if campo in self.campos_publicos}
