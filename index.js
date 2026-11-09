"use strict";

function keyOverride(event) {
	if(!event) return false;
	//if(!document.documentElement.computedStyleMap().get("--margin-lines") || !event)
	if(getComputedStyle(document.documentElement).getPropertyValue("--margin-lines") == "")
		return false;
	//console.log(event);
	switch(true) {
		case event.key == "Home":
			document.documentElement.scroll({left: 0, behavior: "smooth"});
			event.preventDefault();
			//event.stopPropagation();
			//event.stopImmediatePropagation();
			break;
		case event.key == "End":
			document.documentElement.scroll({left: document.body.scrollWidth, behavior: "smooth"});
			event.preventDefault();
			break;
		case event.key == "PageUp":
			document.documentElement.scrollBy({left: -document.body.getBoundingClientRect().width, behavior: "smooth"});
			event.preventDefault();
			break;
		case event.key == "PageDown":
			document.documentElement.scrollBy({left: document.body.getBoundingClientRect().width, behavior: "smooth"});
			event.preventDefault();
			break;
	}
}

if(document.documentElement.classList.contains("col-multi"))
	document.addEventListener("keydown", keyOverride);
