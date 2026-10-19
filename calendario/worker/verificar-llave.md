# Que la llave sirva para algo

Comprobado contra la app publicada, no contra un servidor local.

    URL=https://calendario.abelmedina-py.workers.dev

| Pedido | Esperado | Lo que contestó |
|---|---|---|
| `GET $URL/api/estado` sin cabecera | 401 | 401 |
| `GET $URL/api/estado` con una llave inventada | 401 | 401 |
| `GET $URL/api/estado` con la llave buena | 200 | 200, `{"proyectos":[],"tomas":[],"dias":[]}` |
| `GET $URL/` | 200 | 200 |

La llave está guardada como secreto del Worker (`wrangler secret put LLAVE`) y
anotada en `Proyectos_Claude/CLAVES Y COSAS DE LOS PROYECTOS/calendario`. No
está en el repositorio ni en el código, que es público.

La comparación del Worker es sobre resúmenes SHA-256 con
`crypto.subtle.timingSafeEqual`, así que ni el largo ni el contenido de la
llave se filtran por lo que tarda en responder.
