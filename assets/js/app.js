// (function(){
	// Initialize Firebase
	// Temp UID : dUXuGqt7Y4YzxOUFSzMqnyPTlIJ2 (katherine (9L))
	// https://console.firebase.google.com/u/0/project/recurring-payments-tracker/authentication/providers
	// https://console.developers.google.com/apis/credentials?project=recurring-payments-tracker&authuser=0
	var config = {
		apiKey: "AIzaSyD6FBfO14EljQNaKSud9lHWlsasUita6uY",
		authDomain: "recurring-payments-tracker.firebaseapp.com",
		databaseURL: "https://recurring-payments-tracker.firebaseio.com",
		projectId: "recurring-payments-tracker",
		storageBucket: "recurring-payments-tracker.appspot.com",
		messagingSenderId: "428623070633"
	};
	firebase.initializeApp(config);

	let fbProvder = new firebase.auth.GoogleAuthProvider(),
		fbAuth = firebase.auth(), 
		dbRef = firebase.database(),
		usrRef = dbRef.ref('users'),
		payRef = dbRef.ref('payments'),
		userContext = '',
		runningTotal = 0; //cost of all payments

	$('.btn-add-new').on('click', sendNewPayment);
	$('.payments-items').on('change', 'input, select', updatePayment);
	$('.payments-items').on('click', 'btn-remove-row', delPayment);
	$('.bt-user-login').click(signUserIn);
	$('.bt-user-logout').click(signUserOut);
	
	payRef.on('child_changed', function(data, data2){
		// console.log('child_changed', data, data2);
		showPayments(data);
	});
	payRef.on('child_added', function(data){
		// console.log('child_added', data);
		showPayments(data);
	});
	payRef.on('child_removed', function(data){
		console.log(data);
	});

	fbAuth.onAuthStateChanged(function(user){
		if(user){
			$('.payments-list').show();
			$('.placeholder-for-list').hide();
			$('.user-img').attr('src', user.photoURL);
			$('.user-nm').text(user.displayName);
			setUserContext(user);
		}else{
			$('.payments-list').hide();
			$('.placeholder-for-list').show();
		}
	});

	function signUserIn(){
		let provider = new firebase.auth.GoogleAuthProvider();
		fbAuth.signInWithPopup(provider)
		.then(function(user){
			let p = 'users/' + user.uid,
				o = {uid: user.uid};
			updateFirebase(o, p, 'update');
		})
		.error(function(err){
			console.log('error on signUserIn', err);
		});
	}

	function signUserOut(){
		fbAuth.signOut();
	}

	function setUserContext(user){
		//Get only payments associated with a user
		userContext = '';
	}

	function delPayment(){
		console.log( 'del is not written yet', this );
	}

	/* Function to update only one field when inputs updated */
	function updatePayment(){
		let p = 'payments/' + $(this).parentsUntil('tbody')[1].attributes["data-id"].value,
			o = {};

		//Send updated values to firebase
		o[$(this).attr('name')] = $(this).val();
		updateFirebase(o, p, 'update');
	}

	/* Function to update Firebase when a payment is added and clear form out */
	/* Optionally takes in a childID if this is a full update for some unknown reason */
	function sendNewPayment(){
		console.log('sendNewPayment was called');

		let r = 'payments',
		p = {
			store: $('#new-store').val().trim(),
			desc: '',
			cost: $('#new-cost').val().trim(),
			freqUnit: $('#new-freqUnit').val().trim(),
			firstEvntDay: $('#new-firstEvntDay').val().trim(),
			firstEvntTime: $('#new-firstEvntTime').val().trim()
		};

		// Send New Payment to Firebase (push)
		updateFirebase(p, r);

		//Reset Form
		$('#new-store, #new-cost').val('');
		$('#new-firstEvntTime').val('12:00');
		$('#new-firstEvntDay').val( moment().format('YYYY-MM-DD') );
		$('#new-freqUnit').val('Year');
	}

	/* Function to update Firebase */
	function updateFirebase(o, path = 'payments', t = 'push'){
		console.log('updateFirebase was called', o,path);
		if(t === 'update'){
			firebase.database().ref(path).update(o);
		} else{
			firebase.database().ref(path).push(o);
		}
	}

	/* Function to update UI with a new payment row when a firebase child is added */
	function showPayments(data){
		let ppath = data.ge.path.n[1],
			prow = $('tbody').find(`tr[data-id="${ppath}"]`);
			pstore = data.val().store,
			pdesc = data.val().desc,
			pcost = data.val().cost,
			pfreqUnit = data.val().freqUnit,
			pfirstEvntDay = data.val().firstEvntDay,
			pfirstEvntTime = data.val().firstEvntTime,
			pcostto2020 = countdownTo(pfirstEvntDay, pfirstEvntTime, '2020-01-01', pfreqUnit)*pcost,
			pcounttonext = Math.abs(countdownTo(pfirstEvntDay, pfirstEvntTime, '', 'days')) + ' days'; 
			//alternative option of passing in pfreqUnit here
		
		let pfragment = 
		`<tr data-id="${ppath}">
		<td>
			<label class="sr-only">Description of Payment for Store</label>
			<input type="text" name="desc" value="${pdesc || pstore}">
			<small class="desc-text text-muted">Store: ${pstore}</small>
		</td>
		<td>
			<label class="sr-only">Cost of Recurring Payment</label>
			$<input type="number" name="cost" value="${pcost}">
			<small class="count-until text-muted">Total: $${pcostto2020} by 2020</small>
		</td>
		<td>
			<label>Every</label>
				<select name="freqUnit" value="${pfreqUnit}">
				<option data-unit="Day" ${pfreqUnit==="Day" ? 'selected' : ''}>Day</option>
				<option data-unit="Week" ${pfreqUnit==="Week" ? 'selected' : ''}>Week</option>
				<option data-unit="Month" ${pfreqUnit==="Month" ? 'selected' : ''}>Month</option>
				<option data-unit="Year" ${pfreqUnit==="Year" ? 'selected' : ''}>Year</option>
			</select>
		</td>
		<td>
			<label class="sr-only">Next Charge Date and Time</label>
			<input type="date" name="firstEvntDay" min="2018-01-01" max="2020-01-01" value="${pfirstEvntDay}">
			at 
			<input type="time" step="60" name="firstEvntTime" value="${pfirstEvntTime}">
			<small class="count-until text-muted">Next charge in ${pcounttonext}</small>
		</td>
		<td>
			<button class="btn btn-remove-row">Remove</button>
		</td>
		</tr>`;
		if(prow.length > 0){
			prow.replaceWith(pfragment);
			console.log('replacing');
		} else {
			$('.payments-items').append(pfragment);
		}
	}

	/* Function to calculate the time between a day/time */
	/* and another date (if provided) in specified units */
	function countdownTo( nextEventDay, nextEventTime, untilDate = '', unit = 'days' ){
		return moment((untilDate ? moment(untilDate) : moment()))
		.diff( nextEventDay + ' ' + nextEventTime , unit);
	}

// })();