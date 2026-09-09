# Circuitos AEA

Diseño de instalaciones eléctricas domiciliarias con verificación normativa
según **AEA 90364-7-770, Edición 2017** — *Viviendas unifamiliares hasta 63 A,
clasificaciones BA2 y BD1*.

Se parte de un plano —una foto o un archivo CAD—, se coloca la simbología
encima, se agrupan las bocas en circuitos, y la aplicación devuelve validación
normativa, secciones de cable, diámetros de cañería, cómputo de materiales y
presupuesto.

Corre entera en el navegador: sin backend, sin cuentas, sin subir nada a ningún
lado. Los proyectos se guardan en IndexedDB.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 150 tests
npm run build
```

## Qué hace

**Plano.** Acepta foto o escaneo (JPG, PNG) y archivos **DXF**. La diferencia
práctica es la escala: una foto hay que calibrarla trazando una línea sobre una
distancia conocida, mientras que un DXF ya viene medido y las longitudes salen
exactas del archivo. Sin escala, todo lo que dependa de longitud queda bloqueado
con un aviso explícito, en vez de mostrar números inventados.

**CAD.** Del DXF se leen las unidades (`$INSUNITS`), las capas —que se pueden
apagar para dejar sólo los muros— y la geometría con los bloques ya resueltos.
Sobre eso hay enganche a extremos, puntos medios, intersecciones y
perpendiculares, y detección asistida de ambientes: las polilíneas cerradas dan
la superficie por la fórmula de Gauss y los textos de adentro dan el nombre.

**Ambientes.** Cuando el plano no trae los locales como polilíneas cerradas
—una foto siempre, un DXF a veces— se delimitan a mano: se marcan los vértices
del área y la aplicación devuelve la superficie, el perímetro y, en pasillos y
semicubiertos, la longitud. La medida sale de las unidades del CAD o de la
calibración, con el mismo criterio que las longitudes: sin escala la herramienta
queda bloqueada, en vez de dar una superficie inventada. El contorno queda
guardado, así que las bocas que caen adentro se asignan solas al ambiente y una
recalibración vuelve a medir lo ya dibujado.

Cuando el archivo no declara unidades, la aplicación no adivina: propone la más
plausible por el tamaño del dibujo y pide confirmación. También avisa si la
unidad declarada da un tamaño absurdo, porque un plano dibujado en milímetros y
declarado en metros multiplicaría las superficies por un millón y arrastraría a
todo el grado de electrificación.

**Longitudes.** Los tramos se miden en planta más los recorridos verticales que
el plano no muestra: la bajada de una boca de techo a una llave de pared, o del
tablero al piso. Las alturas de montaje son configurables y vienen sembradas con
los valores que fija la norma.

**Validación.** Trece reglas, cada hallazgo citando la cláusula que lo funda y
proponiendo una acción concreta. Las dos centrales son las que pediste: la
alerta por cantidad de equipos (corriente de proyecto contra corriente admisible
corregida por agrupamiento) y la alerta por distancia (caída de tensión contra
el 3 % de 770.15.6).

**Entregables.** El Anexo 770-A ya exige como contenido mínimo de todo proyecto
exactamente lo que la aplicación produce:

| Anexo | Exige | Vista |
|---|---|---|
| 770-A.1.1 | Síntesis: DPMS, grado, superficie, circuitos, secciones, corrientes | Memoria |
| 770-A.1.2 | Esquema unifilar con In, secciones y PE | Unifilar |
| 770-A.1.3 | Plano con superficies, canalizaciones acotadas y destino de cada boca | Plano |
| 770-A.1.4 | Listado de materiales | Materiales |

**Presupuesto.** Dos bloques: cómputo de materiales con trazabilidad y mano de
obra **por boca**, que es como se cotiza en plaza. Los precios son editables,
llevan fecha visible y se exportan a CSV. Los valores sembrados son orientativos
y están marcados como tales: con la inflación argentina, cualquier precio
embebido nace viejo.

## Cómo está armado

```
src/
  dominio/          tipos y lógica pura, sin React
    calculo/        corriente, sección, caída de tensión, cañerías, longitudes, superficies
    computo/        materiales, presupuesto
  normativa/aea770/
    tablas.ts       las tablas de la norma como datos, cada una con su cláusula
    canerias.ts     Tablas 770.10.VII a IX
    reglas/         un validador puro por regla
    motor.ts        corre todas y agrupa los hallazgos
  cad/              importación DXF: unidades, capas, snapping, ambientes
  simbologia/       galería de símbolos (base IRAM 4504)
  ui/               React
  persistencia/     IndexedDB
```

El motor normativo no depende de React ni del navegador, así que se testea
entero en Node. Materiales, presupuesto y hallazgos son funciones puras sobre el
proyecto: se recalculan, nunca se persisten, y por lo tanto no pueden quedar
desincronizados del plano.

**Stack:** React 18 · TypeScript · Vite · Zustand · Dexie · `dxf` · Tailwind ·
Vitest.

Todo se dibuja en SVG, plano y unifilar por igual: un solo modelo de render, con
hit-testing por DOM e impresión nítida gratis.

## Sobre el algoritmo de cañerías

Es la parte menos obvia. Las Tablas 770.10.VII a IX están indexadas por **una
sola sección** de cable, o sea que valen para un haz homogéneo; un tramo real
casi siempre lleva secciones mezcladas. La norma resuelve ese caso en
770.10.3.8.4 con la regla del **35 % de llenado**.

Entonces: lectura directa de tabla cuando el haz es homogéneo, regla del 35 %
cuando no, salto de una medida si la canalización es corrugada (770.10.3.3.4 e.2)
y los pisos de diámetro de los circuitos terminales y principales.

Un detalle que costó: el piso de diámetro interno **no** se puede derivar del
área libre tabulada. RS 16 tiene 132 mm², que darían 12,96 mm, y sin embargo la
norma lo enumera entre los caños que cumplen el piso de 13 mm. Las áreas son
explícitamente orientativas, así que el piso se codifica con la enumeración del
texto y no con aritmética.

Los tres ejemplos resueltos que trae la norma están como tests dorados en
`tests/canerias.test.ts`.

## Alcance y límites

- **Sólo la Sección 770**: viviendas unifamiliares hasta 63 A, clasificaciones
  BA2 y BD1. Fuera de ese dominio hay que ir a AEA 90364-7-771.
- **DWG no se soporta.** Es binario y propietario, no hay parser JS viable, y la
  única implementación real (LibreDWG a WASM) es GPL-3. Hay que exportar DXF
  desde el CAD; AutoCAD, BricsCAD, LibreCAD y QCAD lo hacen sin plugins.
- **La verificación al cortocircuito** (770.15.2) depende de la corriente
  presunta en el punto de suministro, que es un dato de la distribuidora. Es un
  campo de entrada opcional: la aplicación no lo estima.
- **La detección de ambientes es asistida, no automática.** El tipo de ambiente
  es justo el dato del que dependen los mínimos de la Tabla 770.7.III, y no se
  puede inferir con confianza de un plano.
- **Esto asiste al proyecto, no lo reemplaza.** Toda instalación requiere la
  firma de un profesional matriculado.

## Sobre la norma

El texto de AEA 90364-7-770 **no** está en este repositorio. El ejemplar
consultado es una copia de cortesía de la Asociación Electrotécnica Argentina de
uso restringido. Se versionan únicamente los valores numéricos necesarios para
calcular, cada uno citando la cláusula de la que sale.

La norma se consigue en [aea.org.ar](https://www.aea.org.ar).
