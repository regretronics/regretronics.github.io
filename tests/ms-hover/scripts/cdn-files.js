(function(app) {

    app.cdn = app.cdn || {};

    app.cdn.useAzure = ('GRUNT_REPLACE_USE_CDN' === 'true');
    
    if (app.cdn.useAzure) {
        app.cdn.baseUrls = [
            'http://cdn1.hover.ie/',
            'http://cdn2.hover.ie/',
            'http://cdn3.hover.ie/'
        ];
    } else {
        // use local sound files
        app.cdn.baseUrls = [ '' ];
    }

    app.cdn.getUrl = function(path) {

        var hash = 0,
            i, len, cdnIndex, fullUrl;

        // hash the url so we are consistent in cdn selection
        for (i = 0, len = path.length; i < len; i++) {
            hash = ((hash<<5) - hash) + path.charCodeAt(i);
            hash = hash & hash; // Convert to 32bit integer
        }

        // choose a cdn (1..4) to create the subdomain
        cdnIndex = (Math.abs(hash) % app.cdn.baseUrls.length);
        return app.cdn.baseUrls[cdnIndex] + path;
    };

    app.cdn.getSoundUrl = function(path) {
        return app.cdn.getUrl('sounds/' + path);
    };

})(Hover);
(function(app) {

    app.cdn = app.cdn || {};

    var useCdn = ('GRUNT_REPLACE_USE_CDN' === 'true'),
        cdnUrl = useCdn ? 'http://cdn1.hover.ie/' : '';

    // files that don't need to be preloaded, but will have
    // hashed filenames that need to be accessed from JS
    app.cdn.filenames = {
        retroProgress: cdnUrl + 'images/ui/retroprogress.gif'
    };

})(Hover);
(function(app) {

    var useCdn = ('GRUNT_REPLACE_USE_CDN' === 'true'),
        cdnUrl = useCdn ? 'http://cdn1.hover.ie/' : '';

    // preloaded images are cached in this dictionary
    app.images = {};

    app.loaderImages = {
        star: cdnUrl + 'images/ui/star.png'
    };

    // images that should be both preloaded and cached
    app.preloadAndCacheImages = {

    };

    // images that should be preloaded (but not cached in app.images)
    app.preloadImages = [
        cdnUrl + 'images/ui/sprite.png'
    ];


})(Hover);
(function(app) {

    app.modernSoundFiles = {
        m4a: {
            'ATTKPING': 'Modern/ATTKPING.m4a',
            'CLOAK_EN': 'Modern/CLOAK_EN.m4a', 
            'CLOAK_ST': 'Modern/CLOAK_ST.m4a',
            'FLAGR_DR': 'Modern/FLAGR_DR.m4a',
            'FLAGR_ST': 'Modern/FLAGR_ST.m4a',
            'GAMEOVR': 'Modern/GAMEOVR.m4a', 
            'HIT_MAPE': 'Modern/HIT_MAPE.m4a', 
            'HIT_POD': 'Modern/HIT_POD.m4a', 
            'HIT_ROBT': 'Modern/HIT_ROBT.m4a', 
            'HIT_SHLD': 'Modern/HIT_SHLD.m4a', 
            'HIT_WALL': 'Modern/HIT_WALL.m4a', 
            'HOLD_EN': 'Modern/HOLD_EN.m4a',
            'HOLD_ST': 'Modern/HOLD_ST.m4a', 
            'INVIN_EN': 'Modern/INVIN_EN.m4a', 
            'INVIN_ST': 'Modern/INVIN_ST.m4a', 
            'JUMP_EN': 'Modern/JUMP_EN.m4a', 
            'JUMP_ST': 'Modern/JUMP_ST.m4a', 
            'LEVLSTRT': 'Modern/LEVLSTRT.m4a', 
            'MUSIC': 'Modern/MUSIC.m4a', 
            'OBT_CLOA': 'Modern/OBT_CLOA.m4a', 
            'OBT_HFLG': 'Modern/OBT_HFLG.m4a', 
            'OBT_JUMP': 'Modern/OBT_JUMP.m4a', 
            'OBT_RFLG': 'Modern/OBT_RFLG.m4a', 
            'OBT_WALL': 'Modern/OBT_WALL.m4a', 
            'SHIELD': 'Modern/SHIELD.m4a', 
            'SKID_ST': 'Modern/SKID_ST.m4a', 
            'SPEED_EN': 'Modern/SPEED_EN.m4a', 
            'SPEED_RE': 'Modern/SPEED_RE.m4a', 
            'WINLEVEL': 'Modern/WINLEVEL.m4a'
        },

        ogg: {
            'ATTKPING': 'Modern/ATTKPING.ogg',
            'CLOAK_EN': 'Modern/CLOAK_EN.ogg', 
            'CLOAK_ST': 'Modern/CLOAK_ST.ogg',
            'FLAGR_DR': 'Modern/FLAGR_DR.ogg',
            'FLAGR_ST': 'Modern/FLAGR_ST.ogg',
            'GAMEOVR': 'Modern/GAMEOVR.ogg', 
            'HIT_MAPE': 'Modern/HIT_MAPE.ogg', 
            'HIT_POD': 'Modern/HIT_POD.ogg', 
            'HIT_ROBT': 'Modern/HIT_ROBT.ogg', 
            'HIT_SHLD': 'Modern/HIT_SHLD.ogg', 
            'HIT_WALL': 'Modern/HIT_WALL.ogg', 
            'HOLD_EN': 'Modern/HOLD_EN.ogg',
            'HOLD_ST': 'Modern/HOLD_ST.ogg', 
            'INVIN_EN': 'Modern/INVIN_EN.ogg', 
            'INVIN_ST': 'Modern/INVIN_ST.ogg', 
            'JUMP_EN': 'Modern/JUMP_EN.ogg', 
            'JUMP_ST': 'Modern/JUMP_ST.ogg', 
            'LEVLSTRT': 'Modern/LEVLSTRT.ogg', 
            'MUSIC': 'Modern/MUSIC.ogg', 
            'OBT_CLOA': 'Modern/OBT_CLOA.ogg', 
            'OBT_HFLG': 'Modern/OBT_HFLG.ogg', 
            'OBT_JUMP': 'Modern/OBT_JUMP.ogg', 
            'OBT_RFLG': 'Modern/OBT_RFLG.ogg', 
            'OBT_WALL': 'Modern/OBT_WALL.ogg', 
            'SHIELD': 'Modern/SHIELD.ogg', 
            'SKID_ST': 'Modern/SKID_ST.ogg', 
            'SPEED_EN': 'Modern/SPEED_EN.ogg', 
            'SPEED_RE': 'Modern/SPEED_RE.ogg', 
            'WINLEVEL': 'Modern/WINLEVEL.ogg'
        }
    };   



})(Hover);
(function(app) {

    app.retroSoundFiles = {
        m4a: {
            'ATTKPING': 'Retro/ATTKPING.m4a',
            'CLOAK_EN': 'Retro/CLOAK_EN.m4a',
            'CLOAK_ST': 'Retro/CLOAK_ST.m4a',
            'ENG_HIGH': 'Retro/ENG_HIGH.m4a',
            'ENG_IDLE': 'Retro/ENG_IDLE.m4a',
            'ENG_LOW': 'Retro/ENG_LOW.m4a',
            'ENG_NORM': 'Retro/ENG_NORM.m4a',
            'FLAGR_DR': 'Retro/FLAGR_DR.m4a',
            'FLAGR_ST': 'Retro/FLAGR_ST.m4a',
            'GAMEOVR': 'Retro/GAMEOVR.m4a',
            'HIT_MAPE': 'Retro/HIT_MAPE.m4a',
            'HIT_POD': 'Retro/HIT_POD.m4a',
            'HIT_ROBT': 'Retro/HIT_ROBT.m4a',
            'HIT_SHLD': 'Retro/HIT_SHLD.m4a',
            'HIT_WALL': 'Retro/HIT_WALL.m4a',
            'HOLD_EN': 'Retro/HOLD_EN.m4a',
            'HOLD_ST': 'Retro/HOLD_ST.m4a',
            'INVIN_EN': 'Retro/INVIN_EN.m4a',
            'INVIN_ST': 'Retro/INVIN_ST.m4a',
            'JUMP_EN': 'Retro/JUMP_EN.m4a',
            'JUMP_ST': 'Retro/JUMP_ST.m4a',
            'LEVLSTRT': 'Retro/LEVLSTRT.m4a',
            'OBT_CLOA': 'Retro/OBT_CLOA.m4a',
            'OBT_HFLG': 'Retro/OBT_HFLG.m4a',
            'OBT_JUMP': 'Retro/OBT_JUMP.m4a',
            'OBT_RFLG': 'Retro/OBT_RFLG.m4a',
            'OBT_WALL': 'Retro/OBT_WALL.m4a',
            'SHIELD': 'Retro/SHIELD.m4a',
            'SKID_ST': 'Retro/SKID_ST.m4a',
            'SPEED_EN': 'Retro/SPEED_EN.m4a',
            'SPEED_RE': 'Retro/SPEED_RE.m4a',
            'WINLEVEL': 'Retro/WINLEVEL.m4a'
        },
        ogg: {
            'ATTKPING': 'Retro/ATTKPING.ogg',
            'CLOAK_EN': 'Retro/CLOAK_EN.ogg',
            'CLOAK_ST': 'Retro/CLOAK_ST.ogg',
            'ENG_HIGH': 'Retro/ENG_HIGH.ogg',
            'ENG_IDLE': 'Retro/ENG_IDLE.ogg',
            'ENG_LOW': 'Retro/ENG_LOW.ogg',
            'ENG_NORM': 'Retro/ENG_NORM.ogg',
            'FLAGR_DR': 'Retro/FLAGR_DR.ogg',
            'FLAGR_ST': 'Retro/FLAGR_ST.ogg',
            'GAMEOVR': 'Retro/GAMEOVR.ogg',
            'HIT_MAPE': 'Retro/HIT_MAPE.ogg',
            'HIT_POD': 'Retro/HIT_POD.ogg',
            'HIT_ROBT': 'Retro/HIT_ROBT.ogg',
            'HIT_SHLD': 'Retro/HIT_SHLD.ogg',
            'HIT_WALL': 'Retro/HIT_WALL.ogg',
            'HOLD_EN': 'Retro/HOLD_EN.ogg',
            'HOLD_ST': 'Retro/HOLD_ST.ogg',
            'INVIN_EN': 'Retro/INVIN_EN.ogg',
            'INVIN_ST': 'Retro/INVIN_ST.ogg',
            'JUMP_EN': 'Retro/JUMP_EN.ogg',
            'JUMP_ST': 'Retro/JUMP_ST.ogg',
            'LEVLSTRT': 'Retro/LEVLSTRT.ogg',
            'OBT_CLOA': 'Retro/OBT_CLOA.ogg',
            'OBT_HFLG': 'Retro/OBT_HFLG.ogg',
            'OBT_JUMP': 'Retro/OBT_JUMP.ogg',
            'OBT_RFLG': 'Retro/OBT_RFLG.ogg',
            'OBT_WALL': 'Retro/OBT_WALL.ogg',
            'SHIELD': 'Retro/SHIELD.ogg',
            'SKID_ST': 'Retro/SKID_ST.ogg',
            'SPEED_EN': 'Retro/SPEED_EN.ogg',
            'SPEED_RE': 'Retro/SPEED_RE.ogg',
            'WINLEVEL': 'Retro/WINLEVEL.ogg'  
        }
    };

})(Hover);