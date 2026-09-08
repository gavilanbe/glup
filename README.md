# GLUP — Nila y el pez gato

**Jugar:** https://gavilanbe.github.io/glup/

Plataformas 2D en pixel art para móvil y web. Nila, una niña con chubasquero amarillo, recorre el pantano al anochecer con **Bigotes** bajo el brazo: un pez gato que **sorbe** lo que tenga delante y lo **escupe** como proyectil. Caracoles, ranas, mosquitos, cajas y piedras son munición; los cangrejos se agarran al barro y hay que voltearlos antes de tragarlos.

Todo es HTML + JS vanilla sin dependencias: 320×180 nativos escalados a enteros, sprites dibujados a mano como matrices de caracteres, fondos y tierra generados por procedimiento con la misma paleta, y audio sintetizado con WebAudio. Se instala como app (PWA) y funciona sin conexión.

## Las habilidades de Bigotes

Dos botones, seis cosas claras. El HUD dice en todo momento qué lleva Bigotes en la boca.

- **Sorber** (mantén BIGOTES con la boca vacía): el pez abre la boca y lo que entra en el cono se acerca hasta que hace *glup*. Caracoles, ranas, mosquitos, cajas, piedras… y **agua** de cualquier charca o río.
- **Soplido** (toque con la boca vacía): una bocanada que empuja y aturde a los bichos cercanos. Sirve para quitarse una rana de encima o tirar un caracol al agua.
- **Escupir** (toque con la boca llena): cada munición hace lo suyo. Las **piedras** rompen muros agrietados (todo el bloque de golpe), rebotan y se quedan para volver a usarlas. Las **cajas** vuelan en arco corto y se quedan donde caen: sirven de escalón. Los **bichos** se llevan por delante a otros bichos (¡DOBLE!, ¡TRIPLE!) y se deshacen contra la pared. El **agua** apaga hogueras y empuja enemigos.
- **Escupitajo cargado** (mantén BIGOTES con la boca llena y suelta): Bigotes se hincha y tiembla, un destello avisa de que está listo, y el disparo sale recto y rápido, atraviesa enemigos, voltea cangrejos desde lejos y hace doble daño a la Garza. Con agua, salen tres chorros.
- **Chorro** (con agua en la boca, mantén BIGOTES en el aire): Bigotes escupe hacia abajo y te sostiene flotando mientras dure el agua. Sirve para cruzar ríos anchos; la barra del HUD muestra cuánta agua queda.
- **Apuntar**: ↑ al escupir lanza hacia arriba; ↓ en el aire escupe hacia abajo y Nila da un brinco de retroceso.

Además: las **dianas** abren su compuerta, las **setas** rojas te lanzan muy alto, los **faroles** son puntos de control, las **perlas** cuentan por nivel y los **corazones** curan. Los **cangrejos** no se dejan sorber hasta que los volteas con una pedrada. El agua del pantano te traga (pierdes un corazón y vuelves al farol); las espinas y las hogueras hieren.

Cuatro niveles: el embarcadero, los juncos, la cueva de barro y el nido de la Garza, una jefa que deja caer piedras, planea y se lanza en picado. Devuélveselas.

## Juice

Onomatopeyas flotantes (GLUP, PFF, ¡CRAC!, ¡ZAS!, ¡BOING!, SPLASH, +1), golpe de zoom y sacudida de cámara graduados por impacto, hit-stop, squash & stretch en Nila y en el pez, destello blanco y anillo al reventar un bicho, estelas en los disparos cargados, viñeta roja al recibir daño, vibración del mando, nenúfares que se hunden al pisarlos, luciérnagas al anochecer, esporas en la cueva y cenizas en el nido, ascuas en las hogueras y humo al apagarlas. Todo se apaga con la preferencia de movimiento reducido del sistema.

## Controles

**Teclado:** flechas o WASD mover · Z, K o espacio saltar (soltar pronto acorta el salto) · X, J o C Bigotes · ↑/↓ al escupir apuntan · Esc o P pausa · M sonido · F pantalla completa.

**Mando:** stick o cruceta · A saltar · X, B o gatillos Bigotes · Start pausa.

**Móvil:** en horizontal los mandos flotan sobre el juego (cruceta a la izquierda, ▲ BIGOTES y SALTO a la derecha); en vertical el juego queda arriba y los mandos debajo. Se puede deslizar el pulgar entre ◀ y ▶ sin levantarlo. Los carteles del juego cambian sus textos según juegues con teclado, mando o pantalla táctil. La barra superior tiene pausa, sonido y pantalla completa; se respetan las zonas seguras del teléfono y al pasar la página a segundo plano el juego se pausa solo.

Progreso y sonido se guardan en el navegador. El selector de niveles muestra las perlas y el mejor tiempo de cada uno.

## Código

- `art.js` — paleta, sprites (Nila con parpadeo y carrera; Bigotes cerrado, abierto, lleno, escupiendo y tragando; caracol, rana, mosquito, cangrejo, la Garza con alas en tres posiciones), objetos, tiles, fuente 5×7 con acentos y eñe, logotipo y capas de fondo por tema (anochecer, noche, cueva, nido).
- `audio.js` — efectos sintetizados (el sorbo es un viento en bucle que sube de tono; el chorro, un siseo) y un secuenciador por pasos con tres canciones: pantano, cueva y jefa, más el tema del muelle.
- `levels.js` — niveles compuestos por pantallas de 20×14 celdas con una leyenda de caracteres; los carteles llevan marcadores `{jump}` `{fish}` que se sustituyen por el control real.
- `game.js` — entrada unificada (teclado, mando, táctil), física por pasos de un píxel con plataformas atravesables, coyote time y buffer de salto, succión, soplido, carga, agua y chorro, proyectiles con perforación y estela, enemigos, cajas y piedras que descansan como sólidos, dianas y compuertas, la Garza, cámara con adelanto, partículas, squash & stretch, hit-stop, HUD, título, selector, pausa, resumen de nivel y final.
- `index.html`, `style.css` — envoltorio y mandos táctiles. `manifest.webmanifest`, `sw.js`, `icons/` — instalación como app.
- `tools/captura.sh` captura una escena con Chrome headless (`sprites`, `titulo`, `nivel` con `n`, `x` y un guion de entradas `GUION='fish@1-60;right@70-120'`); `tools/iconos.sh` regenera los iconos desde la escena `icono`.

Construido con Claude Fable 5.1. Licencia MIT.
