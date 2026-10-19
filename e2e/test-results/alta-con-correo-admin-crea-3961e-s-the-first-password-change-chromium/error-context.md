# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: alta-con-correo.spec.ts >> admin creates a student: the temporary password arrives by email and forces the first password change
- Location: tests/alta-con-correo.spec.ts:5:5

# Error details

```
AggregateError: apiRequestContext.get: connect ECONNREFUSED ::1:18025
connect ECONNREFUSED 127.0.0.1:18025
Call log:
  - → GET http://localhost:18025/api/v1/search?query=to%3Ae2e-9582449%40proa-e2e.test
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.8010.12 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br

```