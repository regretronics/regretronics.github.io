"use strict";

let lastCodeObjURL = null;

function structDownload(event) {
	//for the future (as of 2024-08)?: window.showSaveFilePicker()
	try {
		if(!window.ctlStructuredScript) throw(new Error("Structured script control not found."));

		//based on code from https://stackoverflow.com/questions/2897619/using-html5-javascript-to-generate-and-save-a-file
		const data = codeBoxContentGet(ctlStructuredScript);
		let file;
		const properties = {type: 'application/json'}; //constructor parameters: file's MIME-type.

		//date for file name
		const fileName = getDateTimeCode(5) + ".mus.json";

		try {
			//specify the filename using the File constructor, but...
			file = new File([data], fileName, properties);
		} catch(error) {
			//...fall back to the Blob constructor if that isn't supported.
			file = new Blob([data], properties);
		}
		if(lastCodeObjURL) URL.revokeObjectURL(lastCodeObjURL);
		lastCodeObjURL = URL.createObjectURL(file);

		if(!window.aStructDownload) throw(new Error("Anchor element not found (page may be corrupted)."));
		aStructDownload.setAttribute('href', lastCodeObjURL);
		aStructDownload.setAttribute('download', fileName);
		/*const newEvent = new MouseEvent('click');
		aStructDownload.dispatchEvent(newEvent);*/
		aStructDownload.click();
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Failure in file saving. " + (error.message ?? error ?? ""), 3);
		//if(event && event?.target?.title) event.target.title = (error.message ?? error).toString(); //this would overwrite the default title
		return false;
	}
	return true;
}

function mainDragOver(event) {
	if(!event) {
		console.info("mainDragOver(): parameter event is empty. Returning.");
		return false;
	}
	event.preventDefault();
	event.dataTransfer.dropEffect = "copy";
	//to do: UI feedback on accepting dragging
}
function mainDrop(event) {
	if(!event || !event.dataTransfer) {
		console.info("mainDrop(): parameter event.dataTransfer is empty. Returning.");
		return false;
	}
	event.preventDefault();
	try {
		//const data = event.dataTransfer.getData("application/json");
		if(event.dataTransfer.items) {
			const item = event.dataTransfer.items[0];
			if(!item) {
				setToolTip(outToolTip, "No files were dropped.", 1);
				return false;
			}
			if(item.kind === "string" && item.type.match(/^text\/plain/)) {
				item.getAsString(setStructuredText);
			} else
				if(item.kind === "file") {
					item.getAsFile().text()?.then?.(setStructuredText)?.catch?.(reason => {
							setToolTip(outToolTip, "Failed to import dropped file. " + (reason.message ?? reason ?? ""), 3);
							//window.reportError(reason);
							console.error(reason);
						});
				}
		} else {
			if(!event.dataTransfer.files || event.dataTransfer.files.length < 1) {
				setToolTip(outToolTip, "No files were dropped.", 1);
				return false;
			}
			event.dataTransfer.files[0].text()?.then?.(setStructuredText)?.catch?.(reason => {
					setToolTip(outToolTip, "Failed to import dropped file. " + (reason.message ?? reason ?? ""), 3);
					//window.reportError(reason);
					console.error(reason);
				});
		}
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Failed to import dropped file. " + (error.message ?? error ?? ""), 3);
		return false;
	}
	return true;
}

function btnStructImportClick(event) {
	//for the future (as of 2024-08)?: window.showOpenFilePicker()
	importForm.reset(); //needed to reload when choosing same file on Chrome.
	inFile.showPicker(); //asynchronous
}
function inFileChange(event) {
	const fileList = this.files;
	if(!fileList || fileList.length < 1) {
		setToolTip(outToolTip, "No file was chosen.", 2);
		return false;
	}
	try {
		const file = fileList[0];
		file.text()?.then?.(setStructuredText)?.catch?.(reason => {
				setToolTip(outToolTip, "Chosen file could not be read. " + (reason.message ?? reason ?? ""), 3);
				//window.reportError(reason);
				console.error(reason);
			});
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Failed to import chosen file. " + (error.message ?? error ?? ""), 3);
		return false;
	}
	return true;
}
