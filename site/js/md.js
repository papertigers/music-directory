var $container, $footer, $audio, $body;
var $controls, $pullmenu, $info, $smallinfo;
var $csstheme, $csssize;

var viewstack = [];
var playlist = [];
var playlistpos = -1;

var footerheight = 210;

var cache = new BasicCache();

var verbose = true;

var aurora;
var unity;

var istouchdevice = !!('ontouchstart' in window) || !!('onmsgesturechange' in window);
debug('is touch device: ' + istouchdevice);

function debug() {
  if (verbose) console.log.apply(console, arguments);
}

$(document).ready(function() 
   unity = UnityMusicShim();

	//setup some unity things
  unity.setSupports({
    playpause: true,
    next: true,
    previous: true
  });


	unity.setCallbackObject({
  	pause: function() {
			if (aurora && aurora.playing) auroa.pause()
			if (aurora && !aurora.playing) auroa.play()
  	},
  	next: function() {
    	//yourPlayer.skip();
  	},
  	previous:function() {
    	//yourPlayer.previous();
  	}
	});

  $('.column').data('num', 0);

  $audio = $('#audio');
  $body = $('body');
  $container = $('#container');
  $controls = {
    dom: $('#controls'),
    prev: $('#controls .prev'),
    nowplaying: $('#controls .now-playing'),
    next: $('#controls .next')
  };
  $smallinfo = $('#footer .small-info');
  $info = $('#footer .info');
  $csssize = $('#css-size');
  $csstheme = $('#css-theme');
  $footer = $('#footer');
  $pullmenu = $('#footer .pull-menu');

  // override all linksss
  $container.on('click', '.column a', linkclick);
  $container.on('dblclick', '.column a', dbllinkclick);

  if (istouchdevice)
    $container.on('click', '.column a', dbllinkclick);

  // load the playlist
  $.getJSON('/api/cache', function(data) {
    playlist = data;
  });

  // load the hash
  loadlocation(window.location.hash);

  //$audio.on('ended', next);

  // the pull down/up menu for the footer
  $pullmenu.click(function() {
    var $this = $(this);
    var isdown = $this.hasClass('up');

    var opts = {height: (isdown ? '+=' : '-=') + footerheight + 'px'};
    // slide the footer
    $footer.animate(opts, 'slow', function() {
      resetspacers();
      if (isdown) {
        $this.removeClass('up').addClass('down');
        $this.text('down');
      } else {
        $this.removeClass('down').addClass('up');
        $this.text('up');
      }
    });
  });

  // the now playing button
  //$controls.dom.hide();
  $controls.nowplaying.click(function() {
    var src = istouchdevice ? dirname($audio.attr('src')) : $audio.attr('src');
    loadlocation(src);
  });
  $controls.prev.click(prev);
  $controls.next.click(next);

  // theme and size chooser
  var $sizeas = $('#footer .css-size a');
  var $themeas = $('#footer .css-theme a');
  $sizeas.click(_themeclick('css-size'));
  $themeas.click(_themeclick('css-theme'));

  // check local storage
  var csssize = localStorage.getItem('css-size');
  if (csssize)
    $sizeas.each(function() { if ($(this).text() === csssize) $(this).trigger('click'); } )

  var csstheme = localStorage.getItem('css-theme');
  if (csstheme)
    $themeas.each(function() { if ($(this).text() === csstheme) $(this).trigger('click'); } )

  // mousetrap
  Mousetrap.bind('space', toggle);
});

// theme and size callback
function _themeclick(type) {
  return function() {
    var $this = $(this);
    $this.parent().find('a').removeClass('current');
    $this.addClass('current');
    var text = $this.text();

    var $elem = type === 'css-size' ? $csssize : $csstheme;
    $elem.attr('href', '/css/' + text + '.css');
    localStorage.setItem(type, text);
  };
}

// play the song on dbl click
function dbllinkclick() {
  var $this = $(this);
  var isfile = $this.attr('data-isdir') === 'false';
  if (!isfile) return;

  var href= $this.attr('href') || $this.attr('data-href');
  
  play(href)
}

// single click, load some stuff
function linkclick() {
  if (window.webkitNotifications && window.webkitNotifications.checkPermission() === 1) {
    console.log('asking for notifications permission');
    webkitNotifications.requestPermission();
  }
  var $this = $(this);

  var href= $this.attr('data-href');
  if (!href) return true;
  href = href.replace(/#/g, '%23');
  var isdir = $this.attr('data-isdir') === 'true';
  var isfile = $this.attr('data-isdir') === 'false';
  var clearcache = $this.attr('data-clear-cache') === 'true';

  if (clearcache) cache.clear();

  var $parent = $this.parent();
  var num = $parent.data('num');

  // update the window hash
  window.location.hash = href;

  // clear highlighted nodes and highlight the clicked on
  $parent.find('a').removeClass('current');
  $this.addClass('current');

  // figure out what to do with the clicked linked
  var type = isdir ? 'dir' : isfile ? 'file' : 'link';
  debug('click: %s', type);
  switch (type) {
    case 'file':
      var url = href + '?info=true';

      var data = cache.get(href);
      if (data) addcolumn(data, num);
      else $.get(url, loaddata);
      break;
    case 'dir':
      var url = href + '?json=true';

      // check the cache first
      var data = cache.get(href);
      if (data) addcolumn(data, num);
      else $.getJSON(url, loaddata);
      break;
    default:
      $.get(href, loaddata);
      break;
  }

  return false;

  // callback for async ajax reqs
  function loaddata(data) {
    var $column = createcolumn(data, type, href);
    cache.set(href, $column);
    addcolumn($column, num);
  }
}

/**
 * create a column of readdir info to pop onto the stack
 */
function createcolumn(data, type, href) {
  var $column = $(document.createElement('div'));
  $column.addClass('column');

  switch (type) {
    case 'dir':
      // loop the data and add the links
      for (var i in data) {
        var o = data[i];
        var $a = $(document.createElement('a'));
        $a.attr('data-href', '/media' + encodeURIComponent(o.filename).replace(/%2F/g, '/'));
        $a.attr('data-isdir', o.isdir);
        $a.text(basename(o.filename));
        $a.attr('title', $a.text());
        $a.addClass('not-selectable');

        // dirs have arrows
        if (o.isdir) $a.addClass('arrow');

        $column.append($a);
      }
      // empty
      if (!data.length) {
        var $content = $(document.createElement('div'));
        $content.addClass('content');
        $content.text('(empty)');
        $column.append($content);
      }
      break;
    default:
      var $div = $(document.createElement('div'));
      $div.addClass('content');
      $div.html(data);
      $column.append($div);
      break;
  }

  var $spacer = $(document.createElement('div'));
  $spacer.addClass('spacer');
  $column.append($spacer);

  return $column;
}

/**
 * add a column div and handle the stack
 */
function addcolumn($column, num) {
  // pop off some columns from the stack
  var slice = viewstack.length - num;
  for (var i = 0; i < slice; i++) {
    var $oldcol = viewstack.pop();
    $oldcol.find('a').removeClass('current');
    debug('removing column num %d', viewstack.length + 1);
    $oldcol.remove();
  }

  // push the last column onto the stack
  viewstack.push($column);
  $column.data('num', viewstack.length);
  $container.append($column);
  scroll($column.width() * viewstack.length);
  resetspacers();

  debug('pushing num %d onto stack', viewstack.length);
}

function resetspacers() {
  // is the pull menu up?
  $('.spacer').css({height: $footer.height() + 'px'});
}

// ghetto basename & dirname
function basename(s) {
  return s.replace(/^.*\//g, '');
}
function dirname(s) {
  return s.replace(/\/[^\/]+$/, '');
}

// load location
function loadlocation(loc) {
  if (!loc) return;
  debug('loadlocation = %s', loc);
  var parts = loc.split('/').slice(1);
  debug(parts.length);

  docolumn(0);

  function docolumn(i) {
    if (i >= parts.length || !parts[i]) return;
    debug('doculumn(%d)', i);
    var dir = parts[i];

    $('.column').eq(i).find('a').each(function() {
      var $this = $(this);
      var text = $this.text();
      if (text !== dir) return;
      debug('text = %s', dir);

      this.scrollIntoView();
      // defer action
      $this.trigger('click');
      if (!$.active) {
        return docolumn(i+1);
      } else {
        debug('ajax was active, appending an ajax stop');
        $(document).one('ajaxStop', function() {
          debug('ajaxStop for docolumn(%d)', i);
          docolumn(i+1);
        });
      }
    });
  }
}

// play a song number or url
function play(song) {
  console.log('song = ' + song);
  if (typeof song === 'number')
    song = '/media' + playlist[song];
  else if (typeof song === 'string')
    playlistpos = playlist.indexOf(decodeURIComponent(song.replace('/media', '')).replace(/%2F/g, '/'));
  else
    return;
  var songwebsafe = song.replace(/#/g, '%23');

  var songname = basename(song);
  document.title = songname
  //$controls.dom.show();
  debug('song ' + playlistpos + ' of ' + playlist.length);

  if (aurora && aurora.playing) aurora.stop();
  aurora = AV.Player.fromURL(songwebsafe);
  aurora.on('error', function(e) { throw e });
  aurora.on('end', next);
  console.log(aurora);
  aurora.play();

  // get the tags and set the title
  $.getJSON(songwebsafe + '?tags=true', function(data) {
    var s = '';
    if (data.title) s += data.title;
    if (data.artist.length) s += ' - ' + data.artist[0];
    if (!s) s = songname;
    document.title = s;
    $smallinfo.text(s);
    notify('now playing', s, song.slice(1) + '?art=true');
  });

  // set the now playing thing in the pull menu
  $.get(songwebsafe + '?info=true&size=200', function(data) {
    $info.html(data);
  });
}

// prev track
function prev() {
  play(--playlistpos);
}
// next track
function next() {
  play(++playlistpos);
}

// toggle play/pause
function toggle() {
  if (aurora.playing) {
    aurora.pause();
  } else {
    aurora.play();
  }
  console.log('music is now ' + ((aurora.playing) ? 'playing' : 'paused'));
}

