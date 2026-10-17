import { ActivatedRoute, convertToParamMap, Params } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

/**
 * Fake `ActivatedRoute` whose param streams are observable subjects, so a spec can check that
 * a destroyed view no longer listens to them.
 */
export function crearRutaFalsa(params: Params = {}) {
  const paramMap$ = new BehaviorSubject(convertToParamMap(params));
  const params$ = new BehaviorSubject<Params>(params);
  const snapshot = {
    paramMap: convertToParamMap(params),
    queryParamMap: convertToParamMap({}),
    params,
    queryParams: {},
    parent: null,
  };
  const ruta = {
    paramMap: paramMap$,
    params: params$,
    snapshot,
    parent: { paramMap: paramMap$, params: params$, snapshot },
    pathFromRoot: [],
  };
  return {
    provider: { provide: ActivatedRoute, useValue: ruta },
    /** True while any view is still subscribed to a param stream. */
    observado: () => paramMap$.observed || params$.observed,
  };
}
