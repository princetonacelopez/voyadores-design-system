; (function (root, factory) {
	if (typeof exports === 'object') {
		module.exports = factory(window, document)
	} else {
		root.Heiho = factory(window, document)
	}
})(this, function (w, d) {
	function cols(data) {
		var cols = 0;
		for (var i in data) {
			var l = 0;
			if ('object' == typeof data[i]) {
				if (Array.isArray(data[i])) {
					l = data[i].length;
				} else {
					l = Object.keys(data[i]).length;
				}
			}

			if (l > cols) {
				cols = l;
			}
		}

		return cols;
	}

	function load(id) {
		var el = {};
		const iconDownload = `<svg class="icon-sm" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path id="floppy-disk" d="M20.56,6.56,17.44,3.44A1.5,1.5,0,0,0,16.38,3H6A2.652,2.652,0,0,0,3,6V18a2.652,2.652,0,0,0,3,3H18a2.652,2.652,0,0,0,3-3V7.62A1.5,1.5,0,0,0,20.56,6.56ZM9.5,7.25h5a.75.75,0,0,1,0,1.5h-5a.75.75,0,0,1,0-1.5ZM17,19.2a.3.3,0,0,1-.3.3H7.3a.3.3,0,0,1-.3-.3V14.5A1.326,1.326,0,0,1,8.5,13h7A1.326,1.326,0,0,1,17,14.5Z"/></svg>`;
		const parser = new DOMParser();
		const svgDownload = parser.parseFromString(iconDownload, 'text/xml');
		const fileViewer = document.getElementById('dv-file-viewer');

		/* outter preview shell */
		el.shell = document.createElement('div');
		el.shell.setAttribute('id', id);

		/* preview header */
		el.header = document.createElement('div');
		el.header.setAttribute('id', id + '-header');
		el.header.setAttribute('class', 'hstack justify-content-between px-5 py-3');
		el.shell.appendChild(el.header);

		/* preview header title caption */
		el.title = document.createElement('p');
		el.title.setAttribute('id', id + '-title');
		el.title.setAttribute('class', 'fw-bold mb-0');
		el.header.appendChild(el.title);

		/* preview header download button */
		const download = svgDownload.querySelector('svg');
		el.download = document.createElement('a');
		el.download.setAttribute('id', id + '-download');
		el.download.setAttribute('class', 'btn btn-primary');
		el.download.setAttribute('title', 'Download');
		el.download.setAttribute('data-toggle', 'tooltip');
		el.download.setAttribute('data-placement', 'top');
		el.download.appendChild(download);
		el.header.appendChild(el.download);

		/* scrollable wrap of the preview grid  */
		el.scroll = document.createElement('div');
		el.scroll.setAttribute('id', id + '-scroll');
		el.scroll.setAttribute('class', 'table-responsive');
		el.shell.appendChild(el.scroll);

		/* preview table grid */
		el.table = document.createElement('table');
		el.table.setAttribute('id', id + '-table');
		el.table.setAttribute('class', 'table table-bordered table-hover table-freeze');
		el.scroll.appendChild(el.table);

		/* preview grid thead */
		el.thead = document.createElement('thead');
		el.thead.setAttribute('id', id + '-thead');
		el.table.appendChild(el.thead);

		/* preview grid tbody */
		el.tbody = document.createElement('tbody');
		el.tbody.setAttribute('id', id + '-tbody');
		el.table.appendChild(el.tbody);

		/* preview truncate warning */
		el.truncate = document.createElement('div');
		el.truncate.setAttribute('id', id + '-truncated');
		el.truncate.setAttribute('class', 'container-fluid px-4');
		/*el.truncate.style.display = 'none';*/
		el.shell.appendChild(el.truncate);

		fileViewer.appendChild(el.shell);
		return el;
	}

	function label(i) {
		i = parseInt(i);
		if (!i) {
			return '';
		}

		var h = '', j = i, k = 0;
		while (j > 26) {
			k = j % 26;
			j = Math.floor(j / 26);
			h = String.fromCharCode(64 + k) + h;
		}

		h = String.fromCharCode(64 + j) + h;
		return h;
	}



	var options = {
		id: 'heiho-view',
		max: 100,
		header: null,
		resizable: false,
		title: function (el, o) {
			var title = 'CSV';

			if ('file' in o) {
				title = o.file;
			}

			el.innerHTML = title;
		},

		truncate: function (el, max, data, o, size) {
			if (size < max) {
				el.innerHTML = 'Showing ' + size + ' rows, ' + cols(data) + ' in total';
			} else {
				el.innerHTML = 'Showing only first ' + max + ' rows, ' + cols(data) + ' in total';
			}

		},
	}

	function hh(data, o) {
		/* read options */
		o = o || {}
		for (var i in options) {
			if (i in o) {
				continue;
			}

			o[i] = options[i];
		}

		/* get the preview elements */
		var el = load(o.id);

		/* header title */
		var t = o; delete t.title;
		(typeof o.title === 'function')
			? o.title(el.title, t)
			: options.title(el.title, t);

		var columns = cols(data);

		/* preview thead */
		var tr = document.createElement('tr');
		el.thead.innerHTML = '';
		for (var i = 0; i <= columns; i++) {
			var th = document.createElement('th');
			th.innerHTML = label(i);
			tr.appendChild(th)
		}
		el.thead.appendChild(tr);

		/* preview grid rows */
		el.tbody.innerHTML = '';
		el.truncate.innerHTML = '';

		var rows = 0;
		var header = [];
		for (var i in data) {
			if (o.max > 0 && ++rows > o.max) {
				const size = data.length;
				(typeof o.truncate === 'function')
					? o.truncate(el.truncate, o.max, data, o, size)
					: options.truncate(el.truncate, o.max, data, o, size);
				break;
			}

			if (1 === rows) {
				header = data[i];
			}

			var tr = document.createElement('tr');

			var td = document.createElement('td');
			td.innerHTML = rows;
			tr.appendChild(td);

			for (var j in data[i]) {
				td = document.createElement('td');
				td.innerHTML = data[i][j];
				tr.appendChild(td);
			}

			/* pad missing columns */
			if (columns > tr.childNodes.length) {
				while (tr.childNodes.length <= columns) {
					td = document.createElement('td');
					tr.appendChild(td);
				}
			}

			el.tbody.appendChild(tr);
		}

		if (data.length < o.max) {
			const size = data.length;
			(typeof o.truncate === 'function')
				? o.truncate(el.truncate, o.max, data, o, size)
				: options.truncate(el.truncate, o.max, data, o, size);
		}

		/* first row is a header or not */
		if (null === o.header) {
			o.header = true;

			var j = 0;
			for (var i in header) {
				j++;

				if (!header[i]) {
					o.header = false; /* empty header column */
					break;
				}

				if (!isNaN(parseFloat(header[i]))) {
					o.header = false; /* number in header */
					break;
				}
			}

			if (false !== o.header) {
				if (j < columns) {
					o.header = false; /* too short  header row */
				}
			}
		}

		if (o.header) {
			el.tbody.firstChild.classList.add('heiho-header');
		}

		if (o.resizable) {
			$("#heiho-view-table").find("th").resizable({
				handles: "e",
				minWidth: 48,
				cancel: "th:first-child"
			});
		}

		var csv = Papa.unparse(data);
		const blob = new Blob([csv]);
		el.download.href = URL.createObjectURL(blob);
		el.download.download = o.file;
	}

	var Heiho = hh;
	return Heiho;

});
