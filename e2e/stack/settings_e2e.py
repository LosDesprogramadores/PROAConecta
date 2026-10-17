"""Settings used only by the E2E stack (docker-compose.e2e.yml mounts this file and puts it on PYTHONPATH).

It is proa.settings.dev plus a change in the login throttle rates only:
- login (per IP): 5/min -> 200/min. The whole suite reaches the API through the same nginx, so every browser
  shares one client IP and the production value would throttle the suite itself.
- login_dni (per account): 10/hour -> 30/hour. The lockout test exercises this limit; with the production value
  a few reruns on the same stack would lock the demo accounts out.
The value comes from E2E_LIMITE_INTENTOS_CUENTA (default 30), shared with e2e/tests/login-bloqueo.spec.ts.
No application code is modified.
"""
import os

from proa.settings.dev import *  # noqa: F401,F403

REST_FRAMEWORK = {  # noqa: F405
    **REST_FRAMEWORK,  # noqa: F405
    'DEFAULT_THROTTLE_RATES': {
        **REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'],  # noqa: F405
        'login': '200/min',
        'login_dni': f"{os.environ.get('E2E_LIMITE_INTENTOS_CUENTA', '30')}/hour",
    },
}
