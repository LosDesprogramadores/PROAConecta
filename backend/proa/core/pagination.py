"""Paginación opcional (X-18, TSK147).

Pagina solo cuando el pedido trae ``?page``: sin él la respuesta es el arreglo de siempre, así ningún
cliente existente se rompe. Con ``?page`` responde el sobre ``{count, next, previous, results}``.
``page_size`` (por defecto 50) se recorta a 200 y, si no es numérico, se ignora. Una página fuera de
rango es 404 con el formato ``{"detail": ...}`` de la API.
"""
from rest_framework.pagination import PageNumberPagination


class PaginacionOpcional(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200

    def paginate_queryset(self, queryset, request, view=None):
        # ?page_size solo, sin ?page, no activa nada: devolver None deja el arreglo completo
        if self.page_query_param not in request.query_params:
            return None
        # Paginar un queryset sin orden da páginas inestables (y un warning de Django)
        if hasattr(queryset, 'ordered') and not queryset.ordered:
            queryset = queryset.order_by('pk')
        return super().paginate_queryset(queryset, request, view=view)
