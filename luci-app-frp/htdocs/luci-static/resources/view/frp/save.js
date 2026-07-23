'use strict';
'require baseclass';

return baseclass.extend({
	guard(map) {
		const save = map.save;
		let pending;

		map.save = function() {
			if (pending)
				return pending;

			pending = Promise.resolve(save.apply(this, arguments)).finally(function() {
				pending = null;
			});

			return pending;
		};
	}
});
