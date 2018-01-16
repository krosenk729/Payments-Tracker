/* Config
// Setting up firebase
*/

var config = {
	apiKey: "AIzaSyD6FBfO14EljQNaKSud9lHWlsasUita6uY",
	authDomain: "recurring-payments-tracker.firebaseapp.com",
	databaseURL: "https://recurring-payments-tracker.firebaseio.com",
	projectId: "recurring-payments-tracker",
	storageBucket: "recurring-payments-tracker.appspot.com",
	messagingSenderId: "428623070633"
};
firebase.initializeApp(config);
let provider = new firebase.auth.GoogleAuthProvider(),
	currentUser = '',
	seeTotals = true,
	recheck = {},
	countUnit = 'days',
	futureYear = '2020-01-01';

/* Things That Happen When Not Signed In
// User can sign in
// Listen for sign in / auth change
*/

$('.bt-user-login, .placeholder-for-list a').click(signUserIn);
$('.bt-user-logout').click(signUserOut);

function signUserIn() {
	firebase.auth().signInWithPopup(provider)
	.then(function(result) {
		console.log('user sign in triggered', result);
	}).catch(function(error) {
	  	console.log('error on sign in trigger', error);
	});
}
function signUserOut(){
	firebase.auth().signOut()
	.then(function(){
		clearForm();
		firebase.database().ref('payments').off('value');
		firebase.database().ref('payments').off('child_added');
		firebase.database().ref('payments').off('child_changed');
		// signed out -- all UI updates handled by onAuthStateChanged
	});
}

firebase.auth().onAuthStateChanged(function(user) {
  if(user){
    currentUser = {
    	name: user.displayName || user.email, 
    	id: user.uid,
    	img: user.photoURL
    };
    firebase.database().ref('users').child(currentUser.id).update({
    	id: currentUser.id
    });

	function switchUItoSignedIn(u){
		$('.bt-user-login, .placeholder-for-list').hide();
		$('.user-nm').text(u.name);
		$('.user-img').attr('src', u.img);
		$('.user-loggedin, .payments-disp, .payments-form').show();
	}
	switchUItoSignedIn(currentUser);
	onlyIfSignedIn(currentUser);
    console.log('sign in complete', user);

  } else {
    console.log('signed out / no user');
    currentUser = undefined;

	function switchUItoSignedOut(){
		$('.bt-user-login, .placeholder-for-list').show();
		$('.user-nm').text('');
		$('.user-img').attr('src', '');
		$('.user-loggedin, .payments-disp, .payments-form').hide();
		$('.payments-items tr').remove(); // for safety
	}
	switchUItoSignedOut();
  }
});

/* Once a User Signs In
// Listen for 'value' event
// Listen for user add/remove/update values
// Recalculate existing times
// Let a user sign out
*/

function onlyIfSignedIn(user){
	firebase.database().ref('payments').orderByChild('user').equalTo(user.id)
		.on('child_changed', function(data){
			showPayments(data);
		});

	firebase.database().ref('payments').orderByChild('user').equalTo(user.id)
		.on('child_added', function(data){
			showPayments(data);
		});

	firebase.database().ref('payments').orderByChild('user').equalTo(user.id)
		.on('child_removed', function(data){
			unshowPayments(data);
		});

	recheck = setInterval(recheckCountdown, countUnit === 'days' ? 86400000 : 60000 );

	$('.btn-add-new').on('click', sendNewPayment);
	$('.payments-items').on('change', 'input, select', updatePayment);
	$('.payments-items').on('click', '.btn-remove-row', delPayment);


	$('#hidetotal-true').on('change', function(){
		$('#should-hide-money').html('.show-money{visibililty: none !important}');
	});
	$('#hidetotal-false').on('change', function(){
		$('#should-hide-money').empty();
	});
}

/* Function to update Firebase when a payment is added and clear form out */
/* Optionally takes in a childID if this is a full update for some unknown reason */
function sendNewPayment(){
	console.log('sendNewPayment was called');

	let p = 'payments',
	o = {
		store: $('#new-store').val().trim(),
		desc: '',
		cost: $('#new-cost').val().trim(),
		freqUnit: $('#new-freqUnit').val().trim(),
		firstEvntDay: $('#new-firstEvntDay').val().trim(),
		firstEvntTime: $('#new-firstEvntTime').val().trim(),
		user: currentUser.id
	};

	// Send New Payment to Firebase (push)
	updateFirebase(p, o, 'push').then(()=>{ clearForm(); });
}

function clearForm(){
	//Reset Form
	$('#new-store, #new-cost').val('');
	$('#new-firstEvntTime').val('12:00');
	$('#new-firstEvntDay').val( moment().format('YYYY-MM-DD') );
	$('#new-freqUnit').val('year');
}

/* Function to update only one field when inputs updated */
function updatePayment(){
	let p = 'payments/' + $(this).parentsUntil('tbody')[1].attributes["data-id"].value,
		o = {};
	//Send updated values to firebase
	o[$(this).attr('name')] = $(this).val();
	updateFirebase(p, o, 'update');
}

/* Function to remove an entire payment */
function delPayment(){
	let pID =  $(this).parentsUntil('tbody')[1].attributes["data-id"].value;

	// Remove payment and parent reference to payment 
	updateFirebase('payments/' + pID, {}, 'remove');
	updateFirebase('users/' + currentUser.id + '/payments/' + pID, {}, 'remove');
}

/* Function to update Firebase */
function updateFirebase(path = 'payments', o = {}, t = 'push'){
	console.log('updateFirebase was called', o, path);
	switch(t){
		case 'update':
			firebase.database().ref(path).update(o);
			break;
		case 'remove':
			firebase.database().ref(path).remove();
			break;
		case 'push':
		default:
			firebase.database().ref(path).push(o);
			break;
	}
}


/* Function to update UI with a new payment row when a firebase child is added */
function showPayments(data){
	let ppath = data.ge.path.n[1],
		prow = $('tbody').find(`tr[data-id="${ppath}"]`),
		pstore = data.val().store,
		pdesc = data.val().desc,
		pcost = data.val().cost,
		pfreqUnit = data.val().freqUnit,
		pfirstEvntDay = data.val().firstEvntDay,
		pfirstEvntTime = data.val().firstEvntTime,
		pcosttoFuture = formatNumber((countdownTo(pfirstEvntDay, pfirstEvntTime, futureYear, pfreqUnit)+1)*pcost),
		pcounttonext = formatNumber(Math.abs(countdownTo(pfirstEvntDay, pfirstEvntTime, '', countUnit)) + ' ' + countUnit); 
		//alternative option of passing in pfreqUnit here
	
	let pfragment = 
	`<tr data-id="${ppath}">
	<td>
		<label class="sr-only">Description of Payment for Store</label>
		<input type="text" name="desc" value="${pdesc || pstore}" required>
		<small class="desc-text">Store: ${pstore}</small>
	</td>
	<td>
		<label class="sr-only">Cost of Recurring Payment</label>
		$<input type="number" name="cost" value="${pcost}">
		<select name="freqUnit" value="${pfreqUnit}" required>
			<option value="hour" ${pfreqUnit==="hour" ? 'selected' : ''}>Hourly</option>
			<option value="day" ${pfreqUnit==="day" ? 'selected' : ''}>Daily</option>
			<option value="week" ${pfreqUnit==="week" ? 'selected' : ''}>Weekly</option>
			<option value="month" ${pfreqUnit==="month" ? 'selected' : ''}>Monthly</option>
			<option value="year" ${pfreqUnit==="year" ? 'selected' : ''}>Yearly</option>
		</select>
		<small class="cost-until show-money">Total: $${pcosttoFuture} by 2020</small>
	</td>
	<td>
		<label class="sr-only">Next Charge Date and Time</label>
		<input type="date" name="firstEvntDay" min="2018-01-01" max="2020-01-01" value="${pfirstEvntDay}" required>
		at 
		<input type="time" step="60" name="firstEvntTime" value="${pfirstEvntTime}" required>
		<small class="count-until">Next charge in ${pcounttonext}</small>
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

	calcTotal();
}

/* Function to calculate the total cost of all recurring payments */
function calcTotal(){
	let total = 0,
		all = $('.payments-items input[name="cost"]');

	for(let i=0, x = all.length; i < x; i++){
		total += Number(all[i].value);
	}

	$('.payments-totals td:nth-child(2)').text(total);
}

/* Function to Delete a Payment Row From the UI (opposite of showPayment) */
function unshowPayments(data){
	let ppath = data.ge.path.n[1],
		prow = $('tbody').find(`tr[data-id="${ppath}"]`);
	prow.remove();
	calcTotal();
}

/* Function to check / update countdown times */
function recheckCountdown(countUnit){

	let all = $('.payments-items tr');
	// goal: get the firstEvntDay, firstEventTime and tr
	for(let i = 0, x=all.length; i < x; i++){
		let trow = all[i],
			tfirstEvntDay = $(trow).find('input[name="firstEvntDay"]').val(),
			tfirstEvntTime = $(trow).find('input[name="firstEvntTime"]').val(),
			tdiff = countdownTo(tfirstEvntDay, tfirstEvntTime, '', 'seconds');

		if(tdiff > 0){
			let tnewDate = moment(tfirstEvntDay + ' ' + tfirstEvntTime).add(1, $(trow).find('select[name="freqUnit"]').val());
			$(trow).find('input[name="firstEvntDay"]').val(tnewDate.format('YYYY-MM-DD'));
			$(trow).find('input[name="firstEvntTime"]').val(tnewDate.format('HH:mm')).trigger('change');

		} else {
			$(trow).find('.count-until').text('Next charge in '+ Math.abs(countdownTo(tfirstEvntDay, tfirstEvntTime, '', countUnit)) + ' ' + countUnit);
		}
	}
}

/* Function to calculate the time between a day/time */
/* and another date (if provided) in specified units */
function countdownTo( nextEventDay, nextEventTime, untilDate, unit = 'days'){
	return moment(untilDate || new Date()).diff( nextEventDay + ' ' + nextEventTime , unit);
}

function formatNumber(n){
	let newN = '';
	 do{
	   let a = n%10;
	   n = Math.trunc(n/10);
	   newN = a+newN;
	 }while(n>0)

	return newN.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
}
