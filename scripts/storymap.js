$(window).on('load', function () {
  var documentSettings = {};

  // Continuous play variable
  var continuousPlay = true;

  // Move marker variable to global scope
  var markers = [];


  // Placeholder for currently selected audio
  var currentAudio;

  // Interval function for playback
  // Defined in global scope so that it can easily be stoppe/started
  var playInterval;

  // Some constants, such as default settings
  const CHAPTER_ZOOM = 15;

  // This watches for the scrollable container
  var scrollPosition = 0;
  $('div#contents').scroll(function () {
    scrollPosition = $(this).scrollTop();
  });

  $.get('csv/Options.csv', function (options) {

    $.get('csv/Chapters.csv', function (chapters) {
      initMap(
        $.csv.toObjects(options),
        $.csv.toObjects(chapters)
      )
    }).fail(function (e) {
      alert('Found Options.csv, but could not read Chapters.csv')
    });
  });

  /**
   * Reformulates documentSettings as a dictionary, e.g.
   * {"webpageTitle": "Leaflet Boilerplate", "infoPopupText": "Stuff"}
   */
  function createDocumentSettings(settings) {
    for (var i in settings) {
      var setting = settings[i];
      documentSettings[setting.Setting] = setting.Customize;
    }
  }

  /**
   * Returns the value of a setting s
   * getSetting(s) is equivalent to documentSettings[constants.s]
   */
  function getSetting(s) {
    return documentSettings[constants[s]];
  }

  /**
   * Returns the value of setting named s from constants.js
   * or def if setting is either not set or does not exist
   * Both arguments are strings
   * e.g. trySetting('_authorName', 'No Author')
   */
  function trySetting(s, def) {
    s = getSetting(s);
    if (!s || s.trim() === '') {
      return def;
    }
    return s;
  }

  /**
   * Loads the basemap and adds it to the map
   */
  function addBaseMap() {
    var basemap = trySetting('_tileProvider', 'Stamen.TonerLite');
    L.tileLayer.provider(basemap, {
      maxZoom: 18
    }).addTo(map);
  }

  // Add play button
  function addPlayButton() {
    L.easyButton({
      id: 'play-button', // an id for the generated button
      position: 'topright', // inherited from L.Control -- the corner it goes in
      type: 'replace', // set to animate when you're comfy with css
      leafletClasses: true, // use leaflet classes to style the button?
      states: [{ // specify different icons and responses for your button
          stateName: 'play',
          onClick: function (button, map) {
            console.log("Starting playback");
            playLoop(markers);
            button.state("stop");
          },
          title: 'Click to play recordings in sequence',
          icon: 'fa-play'
        },
        {
          stateName: 'stop',
          onClick: function (button, map) {
            console.log("Stopping playback");
            stopLoop();
            button.state("play");
          },
          title: 'Click to stop playback',
          icon: 'fa-stop'
        },
      ]
    }).addTo(map);
  }



  function initMap(options, chapters) {
    createDocumentSettings(options);

    var chapterContainerMargin = 70;

    document.title = getSetting('_mapTitle');
    $('#title').append('<h3>' + getSetting('_mapTitle') + '</h3>');
    $('#title').append(`<a href="http://catalog.paradisec.org.au"><small>${getSetting('_mapSubtitle')}</small></a>`);

    // Load tiles
    addBaseMap();

    // Add button
    addPlayButton();

    // Add zoom controls if needed
    if (getSetting('_zoomControls') !== 'off') {
      L.control.zoom({
        position: getSetting('_zoomControls')
      }).addTo(map);
    }

    changeMarkerColor = function (n, from, to) {
      markers[n]._icon.className = markers[n]._icon.className.replace(from, to);
    }

    var openMarkerPopup = function (n) {
      markers[n].openPopup();
    }

    var closeMarkerPopup = function (n) {
      markers[n].closePopup();
    }

    var pixelsAbove = [];
    var chapterCount = 0;

    var currentlyInFocus; // integer to specify each chapter is currently in focus
    var overlay; // URL of the overlay for in-focus chapter

    for (i in chapters) {
      var c = chapters[i];

      if (!isNaN(parseFloat(c['Latitude'])) && !isNaN(parseFloat(c['Longitude']))) {
        var lat = parseFloat(c['Latitude']);
        var lon = parseFloat(c['Longitude']);

        if (c['Type'] === "music") {
          markers.push(
            L.marker([lat, lon], {
              icon: L.ExtraMarkers.icon({
                icon: 'fa fa-music',
                markerColor: 'red'
              })
            }).bindPopup(`<p>${c["Chapter"]}</p>`)
          )
        } else if (c['Type'] === "speech") {
          markers.push(
            L.marker([lat, lon], {
              icon: L.ExtraMarkers.icon({
                icon: 'fa fa-comment',
                markerColor: 'blue'
              })
            }).bindPopup(`<p>${c["Chapter"]}</p>`)
          )
        }

      } else {
        markers.push(null);
      }

      // Add chapter container
      var container = $('<div></div>', {
        id: 'container' + i,
        class: `chapter-container ${c['Type'] === "music" ? "music-chapter-container": "speech-chapter-container"}`
      });


      // Add media and credits: YouTube, audio, or image
      var media = null;
      var mediaContainer = null;

      // Add media source
      // Default link changed from Media Credit Link to Source
      var source = $('<a>', {
        text: c['Media Credit'],
        href: c['Source'],
        target: "_blank",
        class: 'source'
      });

      // YouTube
      if (c['Media Link'].indexOf('youtube.com/') > -1) {
        media = $('<iframe></iframe>', {
          src: c['Media Link'],
          width: '100%',
          height: '100%',
          frameborder: '0',
          allow: 'autoplay; encrypted-media',
          allowfullscreen: 'allowfullscreen',
        });

        mediaContainer = $('<div></div', {
          class: 'img-container'
        }).append(media).after(source);
      }

      // If not YouTube: either audio or image
      var mediaTypes = {
        'jpg': 'img',
        'jpeg': 'img',
        'png': 'img',
        'mp3': 'audio',
        'ogg': 'audio',
        'wav': 'audio',
      }

      var mediaExt = c['Media Link'].split('.').pop();
      var mediaType = mediaTypes[mediaExt];

      if (mediaType) {
        media = $('<' + mediaType + '>', {
          src: c['Media Link'],
          controls: mediaType == 'audio' ? 'controls' : '',
        });

        mediaContainer = $('<div></div', {
          class: mediaType + '-container'
        }).append(media).after(source);
      }

      var typeSymbol = c["Type"] === "music" ? "<i class='fa fa-music'></i>" : "<i class='fa fa-comment'></i>";

      container
        .append('<p class="chapter-header">' + c['Chapter'] + '\xa0' + typeSymbol + '</p>')
        .append(media ? mediaContainer : '')
        .append(media ? source : '')
        .append('<p class="description">' + c['Description'] + '</p>');

      $('#contents').append(container);

    }

    changeAttribution();

    /* Change image container heights */
    imgContainerHeight = parseInt(getSetting('_imgContainerHeight'));
    if (imgContainerHeight > 0) {
      $('.img-container').css({
        'height': imgContainerHeight + 'px',
        'max-height': imgContainerHeight + 'px',
      });
    }

    // For each block (chapter), calculate how many pixels above it
    pixelsAbove[0] = -100;
    for (i = 1; i < chapters.length; i++) {
      pixelsAbove[i] = pixelsAbove[i - 1] + $('div#container' + (i - 1)).height() + chapterContainerMargin;
    }
    pixelsAbove.push(Number.MAX_VALUE);

    $('div#contents').scroll(function () {
      var currentPosition = $(this).scrollTop();

      // Make title disappear on scroll
      if (currentPosition < 200) {
        $('#title').css('opacity', 1 - Math.min(1, currentPosition / 100));
      }

      for (i = 0; i < pixelsAbove.length - 1; i++) {
        if (currentPosition >= pixelsAbove[i] && currentPosition < (pixelsAbove[i + 1] - 2 * chapterContainerMargin) && currentlyInFocus != i) {
          // Remove styling for the old in-focus chapter and
          // add it to the new active chapter
          $('.chapter-container').removeClass("in-focus").addClass("out-focus");
          $('div#container' + i).addClass("in-focus").removeClass("out-focus");

          // Pause all current audio
          pauseAllAudio();


          // Play current audio element
          currentlyPlaying = document.querySelector('div#container' + i)
            .querySelector("audio")

          setTimeout(function () {
            currentlyPlaying.play()
              .catch(error => console.log(`Play prevented ${error}`));
          }, 500)


          currentlyInFocus = i;

          for (k = 0; k < pixelsAbove.length - 1; k++) {
            // changeMarkerColor(k, 'black', 'blue');
            closeMarkerPopup(k);
          }

          openMarkerPopup(i);


          // Remove overlay tile layer if needed
          if (map.hasLayer(overlay)) {
            map.removeLayer(overlay);
          }

          // Add chapter's overlay tiles if specified in options
          if (chapters[i]['Overlay'] != '') {
            var opacity = (chapters[i]['Overlay Transparency'] != '') ? parseFloat(chapters[i]['Overlay Transparency']) : 1;
            var url = chapters[i]['Overlay'];

            if (url.split('.').pop() == 'geojson') {
              $.getJSON(url, function (geojson) {
                overlay = L.geoJson(geojson, {
                  style: function (feature) {
                    return {
                      fillColor: feature.properties.COLOR,
                      weight: 1,
                      opacity: 0.5,
                      color: feature.properties.COLOR,
                      fillOpacity: 0.5,
                    }
                  }
                }).addTo(map);
              });
            } else {
              overlay = L.tileLayer(chapters[i]['Overlay'], {
                opacity: opacity
              }).addTo(map);
            }

          }

          // Fly to the new marker destination if latitude and longitude exist
          if (chapters[i]['Latitude'] && chapters[i]['Longitude']) {
            var zoom = chapters[i]['Zoom'] ? chapters[i]['Zoom'] : CHAPTER_ZOOM;
            map.flyTo([chapters[i]['Latitude'], chapters[i]['Longitude']], zoom);
          }

          // No need to iterate through the following chapters
          break;
        }
      }
    });


    $('#contents').append(" \
      <div id='space-at-the-bottom'> \
        <a href='#top'>  \
          <i class='fa fa-chevron-up'></i></br> \
          <small>Top</small>  \
        </a> \
      </div> \
    ");

    /* Generate a CSS sheet with cosmetic changes */
    $("<style>")
      .prop("type", "text/css")
      .html("\
      #narration, #title {\
        background-color: " + trySetting('_narrativeBackground', 'white') + "; \
        color: " + trySetting('_narrativeText', 'black') + "; \
      }\
      a, a:visited, a:hover {\
        color: " + trySetting('_narrativeLink', 'blue') + " \
      }")
      .appendTo("head");


    endPixels = parseInt(getSetting('_pixelsAfterFinalChapter'));
    if (endPixels > 100) {
      $('#space-at-the-bottom').css({
        'height': (endPixels / 2) + 'px',
        'padding-top': (endPixels / 2) + 'px',
      });
    }

    var bounds = [];
    for (i in markers) {
      if (markers[i]) {
        markers[i].addTo(map);
        markers[i]['_pixelsAbove'] = pixelsAbove[i];
        markers[i].on('click', function () {
          var pixels = parseInt($(this)[0]['_pixelsAbove']) + 5;
          $('div#contents').animate({
            scrollTop: pixels + 'px'
          });
        });
        bounds.push(markers[i].getLatLng());
      }
    }
    map.fitBounds(bounds);

    $('#map, #narration, #title').css('visibility', 'visible');
    $('div.loader').css('visibility', 'hidden');

    $('div#container0').addClass("in-focus");
    $('div#contents').animate({
      scrollTop: '1px'
    });

  }


  /**
   * Changes map attribution (author, GitHub repo, email etc.) in bottom-right
   */
  function changeAttribution() {
    var attributionHTML = $('.leaflet-control-attribution')[0].innerHTML;
    var credit = 'View <a href="' + googleDocURL + '" target="_blank">data</a>';
    var name = getSetting('_authorName');
    var url = getSetting('_authorURL');

    if (name && url) {
      if (url.indexOf('@') > 0) {
        url = 'mailto:' + url;
      }
      credit += ' by <a href="' + url + '">' + name + '</a> | ';
    } else if (name) {
      credit += ' by ' + name + ' | ';
    } else {
      credit += ' | ';
    }

    credit += 'View <a href="' + getSetting('_githubRepo') + '">code</a>';
    if (getSetting('_codeCredit')) credit += ' by ' + getSetting('_codeCredit');
    credit += ' with ';
    $('.leaflet-control-attribution')[0].innerHTML = credit + attributionHTML;
  }

});


// Test function for iterating through points
function playLoop(markers) {

  // Click a random marker once without delay
  markers[Math.floor(Math.random() * markers.length)].fire("click")

  // Repeat every 20 seconds or so
  playInterval = setInterval(function () {
    let randomMarker = markers[Math.floor(Math.random() * markers.length)];
    randomMarker.fire("click");

  }, 22000);

}

function stopLoop() {
  clearInterval(playInterval);
  pauseAllAudio();
}


function pauseAllAudio() {
  // Pause all audio on page
  var allAudio = document.querySelectorAll('audio');

  allAudio.forEach(node => {
    node.pause()
  })
}


function isPlaying() {
  var allAudio = document.querySelectorAll('audio');
  allAudio.forEach(node => {
    if (!node.paused) {
      return true;
    }

    return false;

  })
}