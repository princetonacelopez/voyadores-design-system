/*!
 * JQuery Custom Repeater v1.6.1
 * (c) 2024 Network Economic Services Ventures Philippines, Inc.
 * Date: 10/01/2024
 * All rights reserved.
 */

(function ($) {
	var settings = [];
	var setting = {};
	var element;
	var loader;

	$.fn.repeater = function (options, params) {
		//If the parameter is object type
		if (typeof options === "object") {
			//New instance of control
			//Create an instance with default values
			element = $(this);
			var currentId = element.attr("id");

			var instance = {
				id: currentId,
				endpoint: "",
				type: "GET",
				mappingFunction: function (data) {
					return "";
				},
				success: function (e, data) {
					return;
				},
				fail: function (error) {
					return;
				},
				messageNoResultHeader: "No data found",
				messageNoResult: `There's nothing to display here at the moment.`,
				cssClassNoResult: "",
				messageLoading: "Loading data...",
				imageEmpty: "/content/images/states/empty/voyadores.default.empty.svg",
				customEmpty: null,
				params: {},
				data: [],
				refresh: refresh,
				sortKey: null,
				sortType: null,
				async: false,
			};
			setting = $.extend(true, instance, options);
			settings.push(setting);

			//Perform elemt content refresh
			refresh();

			//return an instance
			return element;
		}

		//If the parameter is string type
		if (typeof options === "string") {
			//Check if current element setting is already existing
			//If so, use it
			//If not, use whatever was passed
			element = $(this);
			var currentId = element.attr("id");

			if (options == "refresh") {
				var foundSettings = $.grep(settings, function (e) {
					return e.id == currentId;
				});
				var foundSetting = foundSettings[0];

				//If a parameter was passed, set it
				if (params != undefined) foundSetting.params = params;

				if (foundSettings.length > 0) {
					setting = $.extend(true, foundSettings[0], options);
					settings.push(setting);

					//Perform element content refresh
					refresh();

					//return an instance
					return element;
				}
			}

			if (options == "refreshData") {
				var foundSettings = $.grep(settings, function (e) {
					return e.id == currentId;
				});
				var foundSetting = foundSettings[0];

				//If a parameter was passed, set it
				if (params != undefined) foundSetting.data = params;

				if (foundSettings.length > 0) {
					setting = $.extend(true, foundSettings[0], options);
					settings.push(setting);

					//Perform element content refresh
					refreshData();

					//return an instance
					return element;
				}
			}

			if (options == "clear") {
				element.empty();

				//return an instance
				return element;
			}
		}

		return element;
	};

	function refresh() {
		//Add loading status on the element
		generateElementBody(null, 0);

		if (setting.endpoint != "") {
			//Build the API call parameters
			var parameters = {
				context: document.body,
				dataType: "json",
				type: setting.type,
				async: setting.async,
				statusCode: {
					404: function (data) {
						generateElementBody(data, 404);
					},
					500: function (data) {
						generateElementBody(data, 500);
					},
					200: function (data) {
						generateElementBody(data, 200);
					},
				},
			};

			//Check the call type
			if (setting.type.toUpperCase() == "GET") {
				//If GET, build querystring
				var queryString = "";
				try {
					queryString = jQuery.param(setting.params);
				} catch (exception) {
					queryString = "";
				}

				parameters.url = setting.endpoint + "?" + queryString;
			} else if (setting.type.toUpperCase() == "POST") {
				//If POST, past the object as usual
				parameters.url = setting.endpoint;
				parameters.data = setting.params;
			} else {
				setting.fail("Unsupported call type");

				return;
			}

			//Perform the call
			$.ajax(parameters);
		} else {
			refreshData();
		}
	}

	function refreshData() {
		const domainURL = getDomainURL();
		const emptyImageURL = `${domainURL}${setting.imageEmpty}`;

		element.empty();

		try {
			html = setting.mappingFunction(setting.data);
			setting.success(setting.data);
		} catch (exception) {
			html = "";
		}

		if (html == "") {
			html =
				setting.customEmpty ??
				`<div class="text-center status-text border rounded p-6 ${setting.cssClassNoResult}" style="background-color: rgba(106, 106, 106, 0.06);">
            		<img src="${emptyImageURL}" alt="" width="${setEmptyImageWidth(setting.imageEmpty)}" aria-hidden="true" aria-describedby="p-message" />
            		<h4 class="fw-semibold mt-4 mb-0">${setting.messageNoResultHeader}</h4>
            		<p id="p-message" class="text-secondary mt-2 text-wrap mx-auto">${setting.messageNoResult}</p>
            	</div>`;
		}

		element.html(html);
	}

	function generateElementBody(data, code) {
		const domainURL = getDomainURL();
		const loaderImageURL = `${domainURL}/content/images/states/loader/voyadores-loader.gif`;
		const error403ImageURL = `${domainURL}/content/images/states/error/voyadores-403.svg`;
		const error404ImageURL = `${domainURL}/content/images/states/error/voyadores-404.svg`;
		const error500ImageURL = `${domainURL}/content/images/states/error/voyadores-500.svg`;
		const emptyImageURL = `${domainURL}${setting.imageEmpty}`;
		var html = "";

		element.empty();

		//Add a loader
		if (code == 0) {
			html = `<div class="text-center status-text rounded p-6 ${setting.cssClassNoResult}" style="background-color: rgba(106, 106, 106, 0.06);">
                        <img src="${loaderImageURL}" alt="" width="32" aria-hidden="true" />
                        <span class="sr-only">Loading, please wait...</span>
                    </div>`;
		}

		// No permission given
		if (code == 403) {
			html = `<div class="text-center status-text rounded p-6 ${setting.cssClassNoResult}" style="background-color: rgba(106, 106, 106, 0.06);">
                        <img src="${error403ImageURL}" alt="" width="160" aria-hidden="true" aria-describedby="p-message" />
                        <h4 class="fw-semibold mt-4 mb-0">Access forbidden</h4>
                        <p id="p-message" class="small text-tertiary fw-bold mt-2">You don't have permission to view this content.</p>
                   </div>`;
		}

		//No endpoint was found
		if (code == 404) {
			html = `<div class="text-center status-text rounded p-6 ${setting.cssClassNoResult}" style="background-color: rgba(106, 106, 106, 0.06);">
                        <img src="${error404ImageURL}" alt="" width="160" aria-hidden="true" aria-describedby="p-message" />
                        <h4 class="fw-semibold mt-4 mb-0">Content missing</h4>
                        <p id="p-message" class="small text-tertiary fw-bold mt-2">The content you're looking for isn't available. It might have been moved or deleted.</p>
                   </div>`;
		}

		//Something's wrong with the endpoint
		if (code == 500) {
			html = `<div class="text-center status-text rounded p-6 ${setting.cssClassNoResult}" style="background-color: rgba(106, 106, 106, 0.06);">
                        <img src="${error500ImageURL}" alt="" width="160" aria-hidden="true" aria-describedby="p-message" />
                        <h4 class="fw-semibold mt-4 mb-0">Server error</h4>
                        <p id="p-message">There's a problem loading this content. Please try again later.</p>
                   </div>`;
		}

		//Green
		if (code == 200) {
			try {
				html = setting.mappingFunction(data);
				setting.success(data);
			} catch (exception) {
				html = "";
			}

			if (html == "") {
				html = setting.customEmpty ??
					`<div class="text-center status-text border rounded p-6 ${setting.cssClassNoResult}" style="background-color: rgba(106, 106, 106, 0.06);">
                        <img src="${emptyImageURL}" alt="" width="${setEmptyImageWidth(setting.imageEmpty)}" aria-hidden="true" aria-describedby="p-message" />
                        <h4 class="fw-semibold mt-4 mb-0">${setting.messageNoResultHeader}</h4>
                        <p id="p-message" class="text-secondary mt-2 text-wrap mx-auto">${setting.messageNoResult}</p>
                     </div>`;
			}
		}

		element.html(html);
	}

	function getDomainURL() {
		const domainURLInput = document.getElementById("voyadores-cdn-url");
		return domainURLInput?.value || "";
	}

	function setEmptyImageWidth(image) {
		const domainURL = getDomainURL();

		// Map of image URLs to their respective widths
		const imageWidths = {
			[`${domainURL}/content/images/states/empty/general.notifications.empty.svg`]:
				"160",
			[`${domainURL}/content/images/states/empty/voyadores.default.empty.svg`]:
				"80",
		};

		// Ensure the domainURL is included in the image string
		const fullImagePath = image.startsWith(domainURL)
			? image
			: `${domainURL}${image}`;

		// Return the matching width or the default width
		return imageWidths[fullImagePath] || "160";
	}
})(jQuery);
