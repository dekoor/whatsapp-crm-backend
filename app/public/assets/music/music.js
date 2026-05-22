/* ============================================================
   MUSIC — reproductor de fondo (YouTube IFrame API)
   Compartido entre plantillas. La plantilla declara el video
   en el atributo data-video-id del boton:

       <button class="music-toggle"
               data-video-id="6Yq_YFDL-jQ"
               data-state="off">
         <svg class="music-toggle__icon music-toggle__icon--off">...</svg>
         <svg class="music-toggle__icon music-toggle__icon--on">...</svg>
         <span class="music-toggle__pulse"></span>
       </button>
       <div class="yt-host"><div id="yt-player"></div></div>

   El primer tap del usuario en cualquier parte arranca la
   musica automaticamente (politica de autoplay del navegador).
   El estado on/off se guarda en localStorage por pathname.
   ============================================================ */
(function () {
  'use strict';

  var btn = document.querySelector('.music-toggle');
  if (!btn) return;

  var videoId = btn.dataset.videoId;
  if (!videoId) {
    console.warn('[music] data-video-id missing on .music-toggle');
    return;
  }

  // Namespace por pathname para no pisar la pref entre plantillas
  var STORE_KEY = 'music:' + location.pathname;

  var ytPlayer = null;
  var ytReady = false;
  var musicPlaying = false;
  var firstTapBound = false;

  // Carga la IFrame API una sola vez (no importa cuantas
  // plantillas la pidan, comparten la misma script tag)
  if (!window.YT) {
    var tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }

  // YouTube llama a este callback global cuando termina de cargar.
  // Si ya existe (otro modulo registro uno antes), lo respetamos.
  var previousReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function () {
    if (typeof previousReady === 'function') {
      try { previousReady(); } catch (e) {}
    }
    ytPlayer = new YT.Player('yt-player', {
      height: '0',
      width: '0',
      videoId: videoId,
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        loop: 1,
        playlist: videoId
      },
      events: {
        onReady: function () {
          ytReady = true;
          bindFirstTap();
        },
        onStateChange: onYTStateChange
      }
    });
  };

  // Tap del usuario en el boton: alterna play/pause
  btn.addEventListener('click', toggleMusic);

  // Al primer tap del usuario en cualquier parte de la pagina,
  // arrancamos la musica (los navegadores requieren interaccion
  // del usuario antes de permitir autoplay con audio)
  function bindFirstTap() {
    if (firstTapBound) return;
    if (localStorage.getItem(STORE_KEY) === 'off') {
      // Usuario eligio silencio en una sesion previa, respetalo
      return;
    }
    firstTapBound = true;
    var onFirstTap = function () {
      if (!ytReady || musicPlaying) return;
      try { ytPlayer.playVideo(); } catch (e) {}
    };
    // 'click' se dispara solo en taps completos (no drags),
    // asi que arrancar la musica aqui no interfiere con
    // gestos de scroll/drag.
    document.addEventListener('click', onFirstTap, { once: true });
  }

  function toggleMusic() {
    if (!ytReady || !ytPlayer) return;
    if (musicPlaying) {
      ytPlayer.pauseVideo();
      try { localStorage.setItem(STORE_KEY, 'off'); } catch (e) {}
    } else {
      ytPlayer.playVideo();
      try { localStorage.setItem(STORE_KEY, 'on'); } catch (e) {}
    }
  }

  function onYTStateChange(event) {
    // YT.PlayerState codigos: -1 unstarted, 0 ended, 1 playing,
    // 2 paused, 3 buffering, 5 cued
    if (event.data === 1) {
      musicPlaying = true;
      btn.dataset.state = 'on';
      btn.setAttribute('aria-label', 'Pausar música');
    } else if (event.data === 2 || event.data === 0) {
      musicPlaying = false;
      btn.dataset.state = 'off';
      btn.setAttribute('aria-label', 'Reproducir música');
      // YouTube a veces ignora loop=1; forzamos el restart
      if (event.data === 0) {
        try { ytPlayer.seekTo(0); ytPlayer.playVideo(); } catch (e) {}
      }
    }
  }
})();
