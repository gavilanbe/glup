# GLUP — Nila y el pez gato

**Jugar:** https://gavilanbe.github.io/glup/

Plataformas 2D en pixel art para móvil y web. Nila, una niña con chubasquero amarillo, recorre el pantano al anochecer con **Bigotes** bajo el brazo: un pez gato que **sorbe** lo que tenga delante y lo **escupe** como proyectil. Caracoles, ranas, mosquitos, cajas y piedras son munición; los cangrejos se agarran al barro y hay que voltearlos antes de tragarlos.

Todo es HTML + JS vanilla sin dependencias: 320×180 nativos escalados a enteros, sprites dibujados a mano como matrices de caracteres, fondos y tierra generados por procedimiento con la misma paleta, y audio sintetizado con WebAudio. Se instala como app (PWA) y funciona sin conexión.

## Las habilidades de Bigotes

Dos botones y una cruceta. El HUD dice en todo momento qué lleva Bigotes en la boca. El pez tiene **columna vertebral**: se dibuja en rodajas sobre una espina que se dobla hacia lo que va a hacer, con la cola sujeta al brazo. Se curva hacia arriba al apuntar, hacia abajo en el chorro y hacia el aro al izar; ondula al correr; tiembla y alarga la cabeza al sorber; se arquea, se comprime y vibra al cargar; da un latigazo de cola y se lanza al escupir; el trago le recorre el cuerpo como un bulto, y con agua dentro se le ve chapotear en la barriga.

El agua es agua: el escupitajo es un reguero de gotas enlazadas con estela; el chorro de flotar es una columna ondulante que salpica y hace ondas donde toca; al sorber de una charca sube un hilo de agua con ondas en la superficie; cada impacto deja salpicaduras, ondas y un charco que se seca; apagar una hoguera levanta vapor.

- **Sorber** (mantén BIGOTES con la boca vacía): lo que entra en el cono se acerca hasta que hace *glup*. Caracoles, ranas, mosquitos, cajas, piedras… y **agua** de cualquier charca o río. Con ↑ apunta hacia arriba.
- **Izarse** (sorbe un **aro** apuntando arriba): Bigotes se agarra y tira de Nila hasta dejarla colgando bajo el aro. Desde ahí, salta para soltarte o sigue sorbiendo hacia el siguiente aro. Así se suben pozos y salientes.
- **Soplido** (toque con la boca vacía): una bocanada que empuja y aturde a los bichos, hace girar los **molinillos** (abren su compuerta mientras giran) y, encima de una **balsa**, la impulsa hacia el lado contrario.
- **Escupir** (toque con la boca llena): las **piedras** rompen muros agrietados, rebotan y se quedan; las **cajas** vuelan en arco corto y se quedan donde caen; los **bichos** se llevan por delante a otros bichos (¡DOBLE!); el **agua** apaga hogueras y empuja enemigos.
- **Soltar** (↓ y BIGOTES en el suelo): deja lo que lleves a los pies de Nila. Es la forma de poner una caja sobre una **placa de presión**, que mantiene abierta su compuerta mientras algo pese encima.
- **Escupitajo cargado** (mantén con la boca llena y suelta): sale recto y rápido, atraviesa enemigos, voltea cangrejos de lejos, hace doble daño a la Garza y es lo único que rompe la **piedra reforzada**.
- **Chorro** (con agua, mantén BIGOTES en el aire): Bigotes te sostiene flotando mientras dure la barra de agua. Para ríos anchos.

Nila, por su parte, tiene un repertorio de plataformas completo:

- **Salto** con altura variable (soltar pronto lo acorta), *coyote time* y *buffer*.
- **Salto doble**: pulsa salto otra vez en el aire y Bigotes **aletea** (se ve el golpe de cola) para darte un segundo impulso. Llega a salientes de cuatro celdas.
- **Muros de raíces**: al empujar contra ellos Nila **resbala** despacio y puede **saltar de pared en pared**.
- **Planchazo**: ↓ y salto en el aire; Nila se hace un ovillo, Bigotes se pone boca abajo y caen a plomo. Rompe suelo agrietado, aturde a los bichos cercanos y sobre una seta rebota altísimo.
- **Deslizamiento**: ↓ corriendo; pasa por huecos bajos a toda velocidad. Parada, ↓ **agacha**.
- **Trepar salientes**: si llega al borde con las manos, se encarama sola.
- Derrapa al cambiar de sentido, se apoya al sorber y cargar, deja las piernas colgando al flotar o izarse y retrocede al escupir. Carrera de seis fotogramas con bamboleo de capucha y vaivén del chubasquero, respiración en reposo, parpadeo, subida, ápice y caída distintos.

Bigotes nunca está quieto: su cola tiene inercia (un muelle que reacciona a frenazos, saltos y aterrizajes), respira, parpadea y aletea en el salto doble.

Además: las **dianas** abren su compuerta para siempre, las **setas** rojas te lanzan muy alto, los **faroles** son puntos de control, las **perlas** cuentan por nivel y los **corazones** curan. Los **cangrejos** no se dejan sorber hasta que los volteas con una pedrada. El agua del pantano te traga; las espinas y las hogueras hieren.

Cada nivel está construido sobre esos puzles y alturas: tres celdas se saltan, cuatro piden el aleteo, cinco piden caja y aleteo, y más arriba sólo llegan los aros o los muros de raíces. El embarcadero enseña a sorber, escupir, planchar, agacharse, aletear, trepar muros, soplar, apilar e izarse; los juncos combinan dianas, agua y fuego, chorro, placa y balsa; la cueva de barro, a oscuras salvo por faroles, hogueras y perlas, pide el escupitajo cargado, el molinillo, un pozo de tres aros y disparos hacia arriba; y en el nido espera la Garza, que deja caer piedras, planea y se lanza en picado.

## Juice

Onomatopeyas flotantes (GLUP, PFF, ¡CRAC!, ¡ZAS!, ¡BOING!, ¡ARO!, ¡GIRA!, CLIC, SPLASH, +1), golpe de zoom y sacudida de cámara graduados por impacto, hit-stop, squash & stretch en Nila y en el pez, destello blanco y anillo al reventar un bicho, estelas en los disparos cargados, viñeta roja al recibir daño, vibración del mando, nenúfares que se hunden al pisarlos, oscuridad con charcos de luz en la cueva, nubes a la deriva, luciérnagas al anochecer, esporas en la cueva y cenizas en el nido, ascuas en las hogueras y humo al apagarlas. Todo se apaga con la preferencia de movimiento reducido del sistema.

## Controles

**Teclado:** flechas o WASD mover · Z, K o espacio saltar (otra vez en el aire: aleteo; ↓ y salto: planchazo) · X, J o C Bigotes · ↑ apunta arriba · ↓ agacha, desliza o suelta · Esc o P pausa · M sonido · F pantalla completa.

**Mando:** stick o cruceta · A saltar · X, B o gatillos Bigotes · Start pausa.

**Móvil:** en horizontal los mandos flotan sobre el juego (cruceta a la izquierda; ▲, ▼, BIGOTES y SALTO a la derecha); en vertical el juego queda arriba y los mandos debajo. Se puede deslizar el pulgar entre ◀ y ▶ sin levantarlo. Los carteles del juego cambian sus textos según juegues con teclado, mando o pantalla táctil. La barra superior tiene pausa, sonido y pantalla completa; se respetan las zonas seguras del teléfono y al pasar la página a segundo plano el juego se pausa solo.

Progreso y sonido se guardan en el navegador. El selector de niveles muestra las perlas y el mejor tiempo de cada uno.

## Código

- `art.js` — paleta, sprites (Nila con parpadeo y carrera; Bigotes cerrado, abierto, lleno, escupiendo y tragando; caracol, rana, mosquito, cangrejo, la Garza con alas en tres posiciones), objetos, tiles, fuente 5×7 con acentos y eñe, logotipo y capas de fondo por tema (anochecer, noche, cueva, nido).
- `audio.js` — efectos sintetizados (el sorbo es un viento en bucle que sube de tono; el chorro, un siseo) y un secuenciador por pasos con tres canciones: pantano, cueva y jefa, más el tema del muelle.
- `levels.js` — niveles compuestos por pantallas de 20×14 celdas con una leyenda de caracteres (aros, placas, molinillos, balsas, piedra reforzada, hogueras); los carteles llevan marcadores `{jump}` `{fish}` que se sustituyen por el control real.
- `game.js` — entrada unificada (teclado, mando, táctil), física por pasos de un píxel con plataformas atravesables, coyote time y buffer de salto, succión con apuntado, aros que izan, soplido, soltar, agacharse, carga, agua y chorro, balsas que llevan, placas y molinillos que abren y cierran compuertas, iluminación por máscara, proyectiles con perforación y estela, enemigos, cajas y piedras que descansan como sólidos, dianas y compuertas, la Garza, cámara con adelanto, partículas, squash & stretch, hit-stop, HUD, título, selector, pausa, resumen de nivel y final.
- `index.html`, `style.css` — envoltorio y mandos táctiles. `manifest.webmanifest`, `sw.js`, `icons/` — instalación como app.
- `tools/captura.sh` captura una escena con Chrome headless (`sprites`, `titulo`, `nivel` con `n`, `x` y un guion de entradas `GUION='fish@1-60;right@70-120'`); `tools/iconos.sh` regenera los iconos desde la escena `icono`.

Construido con Claude Fable 5.1. Licencia MIT.
