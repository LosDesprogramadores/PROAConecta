from datetime import timedelta

from django.conf import settings


def test_el_access_dura_15_minutos_por_defecto():
    assert settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'] == timedelta(minutes=15)


def test_el_refresh_conserva_7_dias_y_rota_con_blacklist():
    assert settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'] == timedelta(days=7)
    assert settings.SIMPLE_JWT['ROTATE_REFRESH_TOKENS'] is True
    assert settings.SIMPLE_JWT['BLACKLIST_AFTER_ROTATION'] is True
