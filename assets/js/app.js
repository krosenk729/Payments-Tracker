(function(){
/* Initialize
// Declaring variables
// Setting up firebase config
*/
const CONFIG = {
		apiKey: "AIzaSyD6FBfO14EljQNaKSud9lHWlsasUita6uY",
		authDomain: "recurring-payments-tracker.firebaseapp.com",
		databaseURL: "https://recurring-payments-tracker.firebaseio.com",
		projectId: "recurring-payments-tracker",
		storageBucket: "recurring-payments-tracker.appspot.com",
		messagingSenderId: "428623070633"
	},
	PROVIDER = new firebase.auth.GoogleAuthProvider(),
	FUTUREYEAR = '2020-01-01';

firebase.initializeApp(CONFIG);

let currentUser = '',
	countUnit = 'days',
	recheckInt = {};

/* Auth Setup
// Listen for sign in / out
// Listen for auth changes
*/
$('.bt-user-login, .placeholder-for-list a').click(signUserIn);
$('.bt-user-logout').click(signUserOut);


function signUserIn() {
	firebase.auth().signInWithPopup(PROVIDER)
	.then(function(result) {
		console.log('user sign in triggered', result);
	}).catch(function(error) {
	  	console.log('error on sign in trigger', error);
	});
}
function signUserOut(){
	clearInterval(recheckInt);
	firebase.auth().signOut()
	.then(function(){
		clearForm();
		firebase.database().ref('payments').off('value');
		firebase.database().ref('payments').off('child_added');
		firebase.database().ref('payments').off('child_changed');
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

  } else {
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
// Listen for user interactions (add new, update, preference change)
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

	$('.btn-add-new').on('click', sendNewPayment);
	$('.payments-items').on('change', 'input, select', updatePayment);
	$('.payments-items').on('click', '.btn-remove-row', delPayment);

	$('#hidetotal-true').on('change', function(){
		$('#should-hide-money').html('.show-money{visibility: hidden !important}');
	});
	$('#hidetotal-false').on('change', function(){
		$('#should-hide-money').empty();
	});

	$('#countdown-min').on('change', function(){
		clearInterval(recheckInt);
		countUnit = 'minutes';
		recheckInt = setInterval(recheckCountdown, 60000);
	});
	$('#countdown-min').on('change', function(){
		clearInterval(recheckInt);
		countUnit = 'days';
		recheckInt = setInterval(recheckCountdown, 86400000);
	});
	recheckInt = setInterval(recheckCountdown, countUnit === 'minutes' ? 60000 : 86400000 );
}

/* Form Method: sendNewPayment
// Create a new payment in firebase
// When a button within a form is clicked 
*/
function sendNewPayment(){
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

	if(o.store && o.cost && o.firstEvntDay && o.firstEvntTime){
		updateFirebase(p, o, 'push').then( ()=>{clearForm();} );
	}
}

/* Field Method: updatePayment
// Sends an object to firebase as an update
// When field is blurred or changed 
*/
function updatePayment(){
	let p = 'payments/' + $(this).parentsUntil('tbody')[1].attributes["data-id"].value,
		o = {};
	//Send updated values to firebase
	o[$(this).attr('name')] = $(this).val();
	updateFirebase(p, o, 'update');
}


/* Field Method: delPayment
// Sends a delete to firebase for a payment 
// And removes from user reference 
// When remove is clicked for a row 
*/
function delPayment(){
	let pID =  $(this).parentsUntil('tbody')[1].attributes["data-id"].value;

	// Remove payment and parent reference to payment 
	updateFirebase('payments/' + pID, {}, 'remove');
	updateFirebase('users/' + currentUser.id + '/payments/' + pID, {}, 'remove');
}

/* Helper Function: clearForm
// Resets form fields to default values
*/
function clearForm(){
	$('#new-store, #new-cost').val('');
	$('#new-firstEvntTime').val('12:00');
	$('#new-firstEvntDay').val( moment(new Date).format('YYYY-MM-DD') );
	$('#new-freqUnit').val('year');
}

/* Helper Function: updateFirebase
// Sends an object to firebase at a given path with a given operation
*/
function updateFirebase(path = 'payments', o = {}, t = 'push'){
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

/* Helper Function: showPayments
// Accepts an object which represents the return value from a firebase event callback
// Creates an html fragment and appends/replaces a row in the payments table
*/
function showPayments(data){
	let ppath = data.ge.path.n[1],
		prow = $('tbody').find(`tr[data-id="${ppath}"]`),
		pstore = data.val().store,
		pdesc = data.val().desc,
		pcost = data.val().cost,
		pfreqUnit = data.val().freqUnit,
		pfirstEvntDay = data.val().firstEvntDay,
		pfirstEvntTime = data.val().firstEvntTime,
		pcosttoFuture = formatNumber((countdownTo(pfirstEvntDay, pfirstEvntTime, FUTUREYEAR, pfreqUnit)+1)*pcost),
		pcounttonext = formatNumber(Math.abs(countdownTo(pfirstEvntDay, pfirstEvntTime, '', countUnit))) + ' ' + countUnit; 
	
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
		<small class="cost-until show-money">Total: $${pcosttoFuture} by ${moment(FUTUREYEAR).format('YYYY')}</small>
	</td>
	<td>
		<label class="sr-only">Next Charge Date and Time</label>
		<input type="date" name="firstEvntDay" min="${moment(new Date).format('YYYY-MM-DD')}" max="${FUTUREYEAR}" value="${pfirstEvntDay}" required>
		at 
		<input type="time" step="60" name="firstEvntTime" value="${pfirstEvntTime}" required>
		<small class="count-until">Next charge in ${pcounttonext}</small>
	</td>
	<td>
		<button class="btn-remove-row">Remove</button>
	</td>
	</tr>`;
	if(prow.length > 0){
		prow.replaceWith(pfragment);
	} else {
		$('.payments-items').append(pfragment);
	}
	calcTotal();
}


/* Helper Function: calcTotal
// calculates total of all a users' payments
// And shows in a total row  
*/

function calcTotal(){
	let total = 0;
	firebase.database().ref('payments').orderByChild('user').equalTo(currentUser.id)
		.once('value', function(data){
			data = data.val();
			for(let i in data){
				total += Number(data[i].cost);
			}
		});

	$('.payments-totals td:nth-child(2)').text(total);
}

/*Previous function: using jquery UI modifications
function calcTotal(){
	let total = 0,
		all = $('.payments-items input[name="cost"]');

	for(let i=0, x = all.length; i < x; i++){
		total += Number(all[i].value);
	}

	$('.payments-totals td:nth-child(2)').text(total);
}
*/


/* Helper Function: unshowPayments
// Opposite of showPayments
// Accepts an object which represents the return value from a firebase remove event 
// Destroys the table row corresponding to the object
*/
function unshowPayments(data){
	let ppath = data.ge.path.n[1],
		prow = $('tbody').find(`tr[data-id="${ppath}"]`);
	prow.remove();
	calcTotal();
}


/* Helper Function: recheckCountdown
// Checks if a payment date has passed 
// If a date has passed, it is progressed to the next event date
// If a date has not passed, the countdown time until next event is updated
*/
function recheckCountdown(){
	console.log('rechecked');
	firebase.database().ref('payments').orderByChild('user').equalTo(currentUser.id)
		.once('value', function(data){
			data = data.val();
			for(let i in data){
				let tfirstEvntDay = data[i].firstEvntDay,
					tfirstEvntTime = data[i].firstEvntTime,
					tdiff = countdownTo(tfirstEvntDay, tfirstEvntTime, '', 'seconds');

					if(tdiff > 0){
						let tnewDate = moment(tfirstEvntDay + ' ' + tfirstEvntTime).add(1, data[i].freqUnit),
						// need to add 1 freqUnit until dtiff <0 
							p = 'payments/'+ i,
							o = {};
						o.firstEvntDay = tnewDate.format('YYYY-MM-DD');
						o.firstEvntTime = tnewDate.format('HH:mm');
						updateFirebase(p, o, 'update');
					} else {
						$(`[data-id="${i}"] .count-until`).text('Next charge in '
							+ formatNumber(Math.abs(countdownTo(tfirstEvntDay, tfirstEvntTime, '', countUnit)))
							+ ' ' + countUnit);
					}
			}
		});
	console.log('rechecked done');
}


/* Previous function: using jquery 
function recheckCountdown(countUnit){
	let all = $('.payments-items tr');
	console.log('rechecked');
	for(let i = 0, x=all.length; i < x; i++){
		let trow = all[i],
			tfirstEvntDay = $(trow).find('input[name="firstEvntDay"]').val(),
			tfirstEvntTime = $(trow).find('input[name="firstEvntTime"]').val(),
			tdiff = countdownTo(tfirstEvntDay, tfirstEvntTime, '', 'seconds');

		if(tdiff > 0){
			let tnewDate = moment(tfirstEvntDay + ' ' + tfirstEvntTime).add(1, $(trow).find('select[name="freqUnit"]').val()),
				p = 'payments/'+ trow.dataset.id,
				o = {};
				o.firstEvntDay = tnewDate.format('YYYY-MM-DD');
				o.firstEvntTime = tnewDate.format('HH:mm');
			updateFirebase(p, o, 'update');
		} else {
			$(trow).find('.count-until').text('Next charge in '
				+ Math.abs(countdownTo(tfirstEvntDay, tfirstEvntTime, '', countUnit))
				+ ' ' + countUnit);
		}
	}
}
*/


/* Helper Function: coundtownTo
// Returns the time between a day, time and passed date
*/
function countdownTo( nextEventDay, nextEventTime, untilDate, unit = 'days'){
	return moment(untilDate || new Date()).diff( nextEventDay + ' ' + nextEventTime , unit);
}

/* Helper Function: formatNumber
// Returns a number formatted with commas 
// Accounts for scientific notation numbers
*/
function formatNumber(n){
	let newN = '';
	 do{
	   let a = n%10;
	   n = Math.trunc(n/10);
	   newN = a+newN;
	 }while(n>0)

	return newN.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
}

})();