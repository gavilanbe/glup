# GLUP — Nila y el pez gato

**Jugar:** https://gavilanbe.github.io/glup/

Plataformas 2D en pixel art para móvil y web. Nila, una niña con chubasquero amarillo, recorre el pantano al anochecer con **Bigotes** bajo el brazo: un pez gato que **sorbe** lo que tenga delante y lo **escupe** como proyectil. Caracoles, ranas, mosquitos, cajas y piedras son munición; los cangrejos se agarran al barro y hay que voltearlos antes de tragarlos.

Todo es HTML + JS vanilla sin dependencias: 320×180 nativos escalados a enteros, sprites dibujados a mano como matrices de caracteres, fondos y tierra generados por procedimiento con la misma paleta, y audio sintetizado con WebAudio. Se instala como app (PWA) y funciona sin conexión.

## La historia

Cada verano, las crías de pez gato nacen bajo el embarcadero de Nila. Un anochecer bajó la **Garza** y se las tragó a todas… menos a una: **Bigotes**, la más pequeña, que se escondió entre los pilotes. Nila lo coge en brazos y salen río arriba a buscarlas. Lo cuenta una **cinemática de entrada** al estilo de las de Zelda en Game Boy: un picado del cielo al pantano, el banco de crías bajo el embarcadero con rayos de luz, la silueta de la Garza cruzando la luna, su picado con destello y chapuzón, el pico entrando en el agua, Bigotes escondido tras un pilote, el primer plano de Nila y la carrera río arriba con el paisaje en parallax. Música propia por tramos (presagio, tristeza, marcha) y se salta con cualquier botón.

Por el camino, la Garza ha ido dejando crías dormidas en **burbujas**: al tocarlas, la burbuja revienta (*¡PLOP!*) y la cría salta y vuelve nadando a casa. En la pelea final, cada golpe le hace escupir una de las que aún lleva en el buche. **Ruca**, una tortuga vieja que siempre llega antes por sus atajos, espera en cada nivel con consejos y noticias de la Garza; habla letra a letra y lleva un bocadillo mientras no has hablado con ella.

## Bigotes aprende comiendo

Como en Rayman, las habilidades se van consiguiendo, y aquí todas las da el pez: Bigotes es un pez gato joven que aprende un truco cada vez que traga un **bocado** especial. Los bocados brillan en el nivel; al comerlos, Bigotes hace *¡ÑAM!*, hay fanfarria y una tarjeta explica el truco y sus controles. Lo aprendido se guarda.

| Bocado | Truco | Qué permite |
|---|---|---|
| Vilano de diente de león | **Soplido** | Toque de BIGOTES con la boca vacía: aparta y aturde bichos, mueve molinillos y balsas |
| Luciérnaga dorada | **Aleteo** | Salto otra vez en el aire: Bigotes aletea (salto doble) |
| Lapa del pantano | **Ventosa** | Bigotes se pega a los muros de raíces: resbalar y saltar de pared en pared |
| Nenúfar azul | **Trago de agua** | Sorber agua, apagar hogueras, chorro para flotar |
| Anzuelo viejo | **Mordisco** | Morder aros apuntando arriba: Bigotes iza a Nila |
| Canto de río | **Panzazo** | ↓ y salto en el aire: caída de panza que rompe suelo agrietado |
| Guindilla del pantano | **Escupitajo picante** | Mantener y soltar con la boca llena: disparo cargado, rompe piedra reforzada |
| Alga resbaladiza | **Resbalón** | ↓ corriendo: Nila se desliza sobre Bigotes |

El embarcadero da aleteo y soplido; los juncos, ventosa y mordisco; el molino anegado, trago de agua y panzazo; la cueva, guindilla y resbalón. De serie Bigotes sólo sabe sorber y escupir, y Nila correr, saltar y agacharse. El menú de pausa lista lo aprendido y el selector cuenta los trucos.

## Las habilidades de Bigotes

Dos botones y una cruceta. El HUD dice en todo momento qué lleva Bigotes en la boca. El pez tiene **columna vertebral**: se dibuja en rodajas sobre una espina que se dobla hacia lo que va a hacer, con la cola sujeta al brazo. Se curva hacia arriba al apuntar, hacia abajo en el chorro y hacia el aro al izar; ondula al correr; tiembla y alarga la cabeza al sorber; se arquea, se comprime y vibra al cargar; da un latigazo de cola y se lanza al escupir; el trago le recorre el cuerpo como un bulto, y con agua dentro se le ve chapotear en la barriga.

El agua es agua: el escupitajo es una columna gruesa y continua atada a la boca de Bigotes, con cuerpo translúcido, núcleo brillante y reflejos que corren por ella, cabeza estirada con espuma, rocío que se desprende, anillo de presión al salir y, al chocar, corona de salpicadura, onda y chorretones que escurren por las paredes (cargado, el doble de gordo y con espuma); el chorro de flotar es una columna ondulante que salpica y hace ondas donde toca; al sorber de una charca sube un hilo de agua con ondas en la superficie; cada impacto deja salpicaduras, ondas y un charco que se seca; apagar una hoguera levanta vapor.

- **Sorber** (mantén BIGOTES con la boca vacía): lo que entra en el cono se acerca hasta que hace *glup*. Caracoles, ranas, mosquitos, cajas, piedras… y **agua** de cualquier charca o río. Con ↑ apunta hacia arriba.
- **Izarse** (sorbe un **aro** apuntando arriba): Bigotes se agarra y tira de Nila hasta dejarla colgando bajo el aro. Desde ahí, salta para soltarte o sigue sorbiendo hacia el siguiente aro. Así se suben pozos y salientes.
- **Soplido** (toque con la boca vacía): Bigotes toma aire con los mofletes hinchados y suelta una ráfaga que viaja (remolinos, frente de viento, espirales, hojas y polvo levantados) y empuja y aturde a los bichos, hace girar los **molinillos** (abren su compuerta mientras giran) y, encima de una **balsa**, la impulsa hacia el lado contrario.
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

Bigotes está vivo: sus ojos miran lo que importa (el bicho más cercano, arriba al apuntar, abajo al caer, a Nila cuando se aburre), frunce las cejas al sorber y cargar y las arruga cuando le duele, cierra los ojos feliz con corazoncitos por cada cría, ve estrellas tras un golpe, respira por las agallas, rema con la aleta pectoral, brilla y gotea cuando está mojado, se sonroja al cargar, hace pompas si Nila se queda quieta y acaba durmiéndose. Además, nunca está quieto: su cola tiene inercia (un muelle que reacciona a frenazos, saltos y aterrizajes), respira, parpadea y aletea en el salto doble.

Además: las **dianas** abren su compuerta para siempre, las **setas** rojas te lanzan muy alto, los **faroles** son puntos de control, las **crías** rescatadas cuentan por nivel y los **corazones** curan. Los **cangrejos** no se dejan sorber hasta que los volteas con una pedrada. El agua del pantano te traga; las espinas y las hogueras hieren.

Cada nivel está construido sobre esos puzles y alturas: tres celdas se saltan, cuatro piden el aleteo, seis piden caja y aleteo, y más arriba sólo llegan los aros o los muros de raíces. Trepar salientes es sólo una ayuda de cinco píxeles, para que ningún muro se suba sin el truco que toca. El embarcadero enseña a sorber, escupir, planchar, agacharse, aletear, trepar muros, soplar, apilar e izarse; los juncos combinan dianas, agua y fuego, chorro, placa y balsa; el molino anegado, bajo la tormenta, junta agua, fuego fatuo, placas y setas; la cueva de barro, a oscuras salvo por faroles, hogueras y crías, pide el escupitajo cargado, el molinillo, un pozo de tres aros y disparos hacia arriba; y en el nido espera la Garza, que deja caer piedras, planea y se lanza en picado.

## Juice

Onomatopeyas flotantes (GLUP, PFF, ¡PLOP!, ¡PUM!, ¡CRAC!, ¡ZAS!, ¡BOING!, ¡ARO!, ¡GIRA!, CLIC, SPLASH, +1), golpe de zoom y sacudida de cámara graduados por impacto, hit-stop, squash & stretch en Nila y en el pez, destello blanco y anillo al reventar un bicho, estelas en los disparos cargados, viñeta roja al recibir daño, vibración del mando, nenúfares que se hunden al pisarlos, oscuridad con charcos de luz en la cueva, nubes a la deriva, luciérnagas al anochecer, lluvia que salpica al caer y relámpagos con trueno sobre el molino, esporas en la cueva y cenizas en el nido, crías que saltan de su burbuja y se van nadando, ascuas en las hogueras y humo al apagarlas. Todo se apaga con la preferencia de movimiento reducido del sistema.

## Causa y efecto

Cada acción responde de forma proporcional y nada falla en silencio. Lo que se aprieta durante un hit-stop no se pierde: cuenta en cuanto el mundo vuelve a moverse. La puntería hacia arriba se ve antes de disparar (con la boca llena, ↑ ya curva a Bigotes hacia el cielo) y aguanta unos fotogramas si sueltas ↑ justo antes. Al sorber, lo que está en el cono se resiste un instante y luego sale disparado hacia la boca; lo que está un poco más lejos suelta polvo hacia Bigotes para decir «acércate»; el cangrejo sin voltear responde *¡CLONC!* y la Garza, Ruca o la balsa, *¡PESA!*. Cada carga tiene peso: el trago, el sonido, el retroceso y la sacudida del escupitajo van de un mosquito a una caja. El aterrizaje crece con la caída, el panzazo aplasta al bicho sobre el que cae, el aro muerde antes de izar, la rana croa y tiembla antes de saltar, la Garza grita *¡KRAAA!* antes del picado, el chorro avisa *¡POCA!* y tose cuando queda poca agua, y la cámara mira arriba al apuntar o colgar y abajo en las caídas largas. Tras soltar un muro de raíces quedan unos fotogramas para saltar de él, y agachada o deslizándose, el salto la levanta si hay sitio.

## Controles

**Teclado:** flechas o WASD mover · Z, K o espacio saltar (otra vez en el aire: aleteo; ↓ y salto: planchazo) · X, J o C Bigotes · ↑ apunta arriba · ↓ agacha, desliza o suelta · Esc o P pausa · M sonido · F pantalla completa.

**Mando:** stick o cruceta · A saltar · X, B o gatillos Bigotes · Start pausa.

**Móvil:** en horizontal los mandos flotan sobre el juego (cruceta a la izquierda; ▲, ▼, BIGOTES y SALTO a la derecha); en vertical el juego queda arriba y los mandos debajo. Se puede deslizar el pulgar entre ◀ y ▶ sin levantarlo. Los carteles del juego cambian sus textos según juegues con teclado, mando o pantalla táctil. La barra superior tiene pausa, sonido y pantalla completa; se respetan las zonas seguras del teléfono y al pasar la página a segundo plano el juego se pausa solo.

Progreso y sonido se guardan en el navegador. El selector de niveles muestra las crías rescatadas y el mejor tiempo de cada uno.

## Código

- `art.js` — paleta, sprites (Nila con parpadeo y carrera; Bigotes cerrado, abierto, lleno, escupiendo y tragando; caracol, rana, mosquito, cangrejo, la Garza con alas en tres posiciones), objetos, tiles, fuente 5×7 con acentos y eñe, logotipo y capas de fondo por tema (anochecer, noche, tormenta con molino, cueva, nido).
- `mundo.js` — el mundo, encima de `art.js`: la tierra del pantano con autotiles (esquinas redondeadas, labio de musgo con briznas y flores, mantillo, estratos, raíces, piedras, conchas y huesos, más oscura cuanto más adentro; se pinta una vez por nivel en tiras de 256 px), agua con espuma en las orillas, tablones, zarzas, piedra agrietada y reforzada, muros de raíces, compuertas, dianas, setas, fuegos fatuos, farol, cartel, barca y cajas; fondos en capas con cielo tramado, luna con halo, colinas, cipreses calvos con barba de viejo, bruma y eneas, la cueva con estalactitas, gusanos de luz y hongos que brillan, y el ciprés muerto del nido.
- `audio.js` — efectos sintetizados (el sorbo es un viento en bucle que sube de tono; el chorro, un siseo) y un secuenciador por pasos con canciones de pantano, tormenta (con lluvia de fondo), cueva y jefa, más el tema del muelle; trueno y voz de Ruca.
- `levels.js` — niveles compuestos por pantallas de 20×14 celdas con una leyenda de caracteres (aros, placas, molinillos, balsas, piedra reforzada, hogueras); los carteles llevan marcadores `{jump}` `{fish}` que se sustituyen por el control real.
- `game.js` — entrada unificada (teclado, mando, táctil), física por pasos de un píxel con plataformas atravesables, coyote time y buffer de salto, succión con apuntado, aros que izan, soplido, soltar, agacharse, carga, agua y chorro, balsas que llevan, placas y molinillos que abren y cierran compuertas, iluminación por máscara, proyectiles con perforación y estela, enemigos, cajas y piedras que descansan como sólidos, dianas y compuertas, la Garza, cámara con adelanto, partículas, squash & stretch, hit-stop, HUD, título, selector, pausa, resumen de nivel y final.
- `cine.js` — la cinemática de entrada: planos con cámara, zooms y parallax, todo en función del tiempo (`tools/captura.sh cine T`).
- `aprende.js` — aprender un truco como coger un objeto en Zelda: el mundo se para con un foco sobre Nila, las chispas entran en espiral en Bigotes, Nila lo alza con rayos de luz y fanfarria, el nombre cae letra a letra en una cinta y un recuadro enseña el truco en bucle con los botones dibujados como teclas; al seguir, el bocado vuela al HUD.
- `hud.js` — el HUD: corazones que laten (deprisa con una sola vida, con los bordes de la pantalla en rojo), se parten en dos al perder vida y se rellenan al curarse; medallón con la cara de Bigotes que reacciona y burbuja con lo que lleva en la boca (lo tragado vuela hasta ella, los bichos se revuelven, el agua se mece, la carga es un anillo); las crías vuelan al contador; barra de la Garza con rastro de daño.
- `mapa.js` — el selector de niveles como mapa del pantano: el río serpentea del embarcadero al ciprés de la Garza, cada nivel es un lugar con su icono, Nila camina entre ellos y una ficha muestra la vista previa, las crías y el mejor tiempo.
- `titulo.js` — la pantalla de título: el logotipo a trazos gordos con la piel de Bigotes (la G es su cabeza, con ojo y bigotes) y la entrada en la que Bigotes salta del agua, escupe las letras una a una y vuelve a los brazos de Nila.
- `index.html`, `style.css` — envoltorio y mandos táctiles. `manifest.webmanifest`, `sw.js`, `icons/` — instalación como app.
- `tools/sim.js` carga el juego en Node sin pantalla (fotograma a fotograma, con instantáneas); `tools/bot.js` recorre cada nivel siguiendo `tools/rutas.js` con una búsqueda best-first y comprueba que se puede terminar con los trucos que da; `tools/check-levels.js` revisa la forma de los niveles.
- `tools/captura.sh` captura una escena (con `ZOOM=5` se acerca a Nila) con Chrome headless (`sprites`, `titulo`, `nivel` con `n`, `x` y un guion de entradas `GUION='fish@1-60;right@70-120'`); `tools/iconos.sh` regenera los iconos desde la escena `icono`.

Construido con Claude Fable 5.1. Licencia MIT.
