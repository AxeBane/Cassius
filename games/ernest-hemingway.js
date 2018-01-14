/**
 * Ernest Hemingway
 * Cassius - https://github.com/sirDonovan/Cassius
 *
 * This is a scripted version of Ernest Hemingway, a popular poetry-related
 * game in the Writing room.
 *
 * @author Mystifi <bornfromthemyst@gmail.com>
 * @license MIT
 */

'use strict';

const name = "Ernest Hemingway";
const defaultThemes = ["nature", "school", "family", "love", "friendship", "sadness", "time"];
const commandCharacter = Config.commandCharacter;

const database = Storage.getDatabase('writing');

class ErnestHemingway extends Games.Game {
	/**
	 * @param {Room} room
	 */
	constructor(room) {
		super(room);
		this.freeJoin = false;
		this.canLateJoin = true;
		/**@type {?NodeJS.Timer} */
		this.timeout = null;
		this.points = new Map();
		this.maxPoints = 5;
		this.winnerPointsToBits = 10;
		this.loserPointsToBits = 5;
		this.submissionsOpen = false;
		this.submissionsWarned = false;
		this.totalSubmissions = 0;
		/**@type {Map<Player, string>} */
		this.submissions = new Map();
		this.votingOpen = false;
		this.totalVotes = 0;
		/**@type {Map<Player, number>} */
		this.voteNumbers = new Map();
		/**@type {Map<Player, Player>} */
		this.votes = new Map();
		/**@type {?Array<string>} */
		this.ties = null;
		this.roundTheme = "";
		/**@type {Array<string>} */
		this.previousThemes = [];
		/**@type {?Player} */
		this.themeSelector = null;
		this.pmCommands = {
			"theme": true,
			"vote": true,
		};
	}

	/**
	 * This is only a shortcut for continuously writing `this.timeout = setTimeout(...);`
	 *
	 * @param {Function} method
	 * @param {number} time
	 */
	setTimeout(method, time) {
		this.timeout = setTimeout(method, time);
	}

	selectRandomTheme() {
		let theme = Tools.sample(defaultThemes);
		while (this.previousThemes.includes(theme)) {
			theme = Tools.sample(defaultThemes);
		}
		this.previousThemes.push(theme);
		this.roundTheme = theme;
	}

	onStart() {
		this.say("Starting in a few seconds! Begin thinking of a theme in case you're chosen!");
		this.setTimeout(() => this.setupRound(), 5 * 1000);
	}

	/**
	 * @param {Player} [winner] The winner of the previous round
	 */
	setupRound(winner) {
		let player = winner || Tools.sample(this.shufflePlayers().filter(player => !player.eliminated));
		this.say("**" + player.name + "**, you have **one (1) minute** to PM me a theme using ``" + commandCharacter + "theme [theme]`` for the current round!");
		this.themeSelector = player;
		this.setTimeout(() => this.nextRound(), 60 * 1000);
	}

	onNextRound() {
		let isTie = !!this.ties;
		if (!this.roundTheme || isTie) {
			this.say("I'm selecting a random theme...");
			this.selectRandomTheme();
		}
		this.themeSelector = null;
		if (isTie) {
			this.round--;
			this.say("/wall **Round " + this.round + " (Tie)** | **Tied players (" + this.ties.length + ")**: " + this.ties.join(", "));
		} else {
			this.say("/wall **Round " + this.round + "** | **Players (" + this.playerCount + ")**: " + this.getPoints());
		}
		this.say("You have **" + (isTie ? "one minute" : "one and a half minutes") + "** to write about **" + this.roundTheme + "**!");
		this.setTimeout(() => this.startSubmissions(isTie), (isTie ? 1 : 1.5) * 60 * 1000);
	}

	/**
	 * @param {boolean} isTie
	 */
	startSubmissions(isTie) {
		this.say("/wall **Time's up**! You have **one minute** to submit your entries in the chat using ``" + commandCharacter + "submit [entry]``!");
		if (isTie) this.say("Reminder that only the tied players can submit entries!");
		this.submissionsOpen = true;
		if (this.ties) this.ties = this.ties.map(name => Tools.toId(name));
		this.setTimeout(() => this.startVoting(isTie), 60 * 1000);
	}

	/**
	 * @param {boolean} [isTie]
	 */
	startVoting(isTie) {
		let awaitingSubmissions = Object.keys(this.players).filter(player => !this.submissions.has(this.players[player]));
		if (awaitingSubmissions.length && !(isTie || this.submissionsWarned)) {
			this.say("I'm still waiting for " + awaitingSubmissions.map(player => this.players[player].name).join(", ") + " to submit their entr" + (awaitingSubmissions.length > 1 ? "ies" : "y") + "!");
			this.submissionsWarned = true;
			this.setTimeout(() => this.startVoting(), 60 * 1000);
			return;
		}
		this.submissionsOpen = false;
		this.say("/wall You have **one minute** to submit your votes via PMs using ``" + commandCharacter + "vote [player]``!");
		this.votingOpen = true;
		this.setTimeout(() => this.parseVotes(), 60 * 1000);
	}

	parseVotes() {
		let awaitingVotes = Object.keys(this.players).filter(player => !this.votes.has(this.players[player]));
		if (awaitingVotes.length) {
			this.say("I'm still waiting for " + awaitingVotes.map(player => this.players[player].name).join(", ") + " to submit their vote" + (awaitingVotes.length > 1 ? "s" : "") + "!");
			this.setTimeout(() => this.parseVotes(), 60 * 1000);
			return;
		}
		this.votingOpen = false;
		let votes = Array.from(this.voteNumbers).sort((a, b) => b[1] - a[1]);
		votes = votes.filter(vote => vote[1] === votes[0][1]);
		if (votes.length > 1) {
			this.ties = votes.map(vote => vote[0].name);
			this.say("/wall There is a tie between the following users: " + this.ties.join(", ") + ". A round will occur between the " + this.ties.length + " winners.");
			this.setTimeout(() => this.finishRound(true), 5 * 1000);
			return;
		}
		let [winner, number] = votes[0]; // eslint-disable-line no-restricted-syntax
		let points = this.points.get(winner) || 0;
		points += 1;
		this.points.set(winner, points);
		this.say("**" + winner.name + "** won the round with a total of **" + number + "** votes!");
		if (points >= this.maxPoints) {
			this.winners.set(winner, points);
			this.say("**" + winner.name + "** has won the game!");
			this.end();
			return;
		}
		this.setTimeout(() => this.finishRound(false, winner), 5 * 1000);
	}

	/**
	 * @param {boolean} isTie
	 * @param {Player} [winner]
	 */
	finishRound(isTie, winner) {
		this.totalVotes = 0;
		this.voteNumbers.clear();
		this.votes.clear();
		this.totalSubmissions = 0;
		this.submissions.clear();
		if (this.submissionsWarned) this.submissionsWarned = false;
		if (!isTie) {
			if (this.ties !== null) this.ties = null;
			this.roundTheme = "";
			this.setTimeout(() => this.setupRound(winner), 5 * 1000);
			return;
		}
		this.setTimeout(() => this.nextRound(), 5 * 1000);
	}

	onEnd() {
		// We want to give quills rather than points; therefore, we'll
		// use `Games.Game#convertBitsToPoints` for reference.
		this.points.forEach((points, player) => {
			let isWinner = this.winners.has(player);
			let quills = 0;
			if (isWinner) {
				quills = points * this.winnerPointsToBits;
			} else {
				quills = points * this.loserPointsToBits;
			}
			if (quills) this.giveQuills(quills, player, isWinner);
		});
	}

	/**
	 * @param {number} quills
	 * @param {Player} player
	 * @param {boolean} isWinner
	 */
	giveQuills(quills, player, isWinner) {
		// If the Scribe Shop does not exist, then we're missing the Writing plugin,
		// and quills would be effectively useless.
		if (!('scribeShop' in database)) throw new Error("Quills rely upon the Writing room plugin.");
		// @ts-ignore TODO: Refactor Scribe Shop code with TypeScript.
		let accountIndex = database.scribeShop.findIndex(curAccount => player.id === curAccount.account);
		if (accountIndex < 0) {
			accountIndex = database.scribeShop.length;
			database.scribeShop.push({'account': player.id, 'bal': 0, 'totalEarned': 0});
		}
		let userAccount = database.scribeShop[accountIndex];
		userAccount.bal += quills;
		userAccount.totalEarned += quills;
		this.pm(player, "You have earned **" + quills + "** quills for " + (isWinner ? "winning" : "participating in") + " the game of " + name + "!");
	}

	/**
	 * Sets the theme of the next round. Able to be overwritten by staff.
	 * @param {string} target
	 * @param {User} room
	 * @param {User} user
	 */
	theme(theme, room, user) {
		// Ensures that the user is the theme selector or a staff member in the game room.
		if (!this.themeSelector || !(this.themeSelector.id === user.id || user.hasRank(this.room, '%'))) return;
		if (room instanceof Rooms.Room) return this.say("Please use this command in PMs.");
		theme = theme.trim();
		if (!theme) return this.pm(user, "You have to give me a valid theme... ;w;");
		let words = theme.split(' ');
		if (words.length >= 4) return this.pm(user, "That is too verbose; try a more concise theme.");
		if (this.previousThemes.includes(theme)) return this.pm(user, "Please choose a theme that has not been used during this game.");
		this.previousThemes.push(theme);
		this.roundTheme = theme;
		this.pm(user, "The theme has been successfully set!");
		this.room.users.forEach((rank, curUser) => {
			if (curUser !== user && curUser.hasRank(this.room, '%')) {
				this.pm(curUser, user.name + " has changed the theme to __" + theme + "__. If you would like to override it, please use ``" + commandCharacter + "theme [theme]``.");
			}
		});
	}

	/**
	 * Submits a user's entry for the current round.
	 * @param {string} submission
	 * @param {Room} room
	 * @param {User} user
	 */
	submit(submission, room, user) {
		if (!this.submissionsOpen) return this.say("I cannot accept any submissions right now.");
		let player = this.players[user.id];
		if (!player || player.eliminated) {
			let eliminated = player.eliminated;
			this.pm(user, "You are not currently playing the game" + (eliminated ? " due to being eliminated" : "") + ".");
			if (this.canLateJoin && !eliminated) this.pm(user, "If you would like to play, use ``" + commandCharacter + "join``.");
			return;
		}
		if (player.eliminated) return this.pm(user, "You are eliminated and cannot submit and entry.");
		if (this.ties && !this.ties.includes(player.id)) return this.say("Only tied players can enter submissions.");
		submission = submission.trim();
		if (!submission) {
			let submitted = this.submissions.get(player) || "";
			return this.pm(user, submitted ? "Your current submission is: " + submitted : "You haven't submitted an entry.");
		}
		let words = submission.split(' ');
		if (words.length < 3 || words.length > 6) return this.pm(user, "Submissions must be between three and six words.");
		this.submissions.set(player, submission);
		this.pm(user, "Your submission has been entered! If you made a typo, reuse the command.");
		this.totalSubmissions++;
		if (this.totalSubmissions === this.playerCount) {
			clearTimeout(this.timeout);
			this.startVoting();
		}
	}

	/**
	 * Submits a vote for the winner of the current round.
	 * @param {string} playerId
	 * @param {User} room
	 * @param {User} user
	 */
	vote(playerId, room, user) {
		if (room instanceof Rooms.Room) return this.say("Please use this command in PMs.");
		if (!this.votingOpen) return this.pm(user, "I cannot accept any votes right now.");
		let player = this.players[user.id];
		if (!player || player.eliminated) {
			let eliminated = player.eliminated;
			this.pm(user, "You are not currently playing the game" + (eliminated ? " due to being eliminated" : "") + ".");
			if (this.canLateJoin && !eliminated) this.pm(user, "If you would like to play, use ``" + commandCharacter + "join``.");
			return;
		}
		playerId = Tools.toId(playerId);
		if (!playerId) {
			let currentVote = this.votes.get(player) || "";
			return this.pm(user, currentVote ? "You are currently voting for " + currentVote + "." : "You haven't submitted a vote.");
		}
		if (!(playerId in this.players)) return this.pm(user, "Please vote for a user who is playing the game.");
		let targetPlayer = this.players[playerId];
		if (targetPlayer.id === player.id) return this.pm(user, "You cannot vote for yourself, silly. ^^;");
		if (this.ties && !this.ties.includes(targetPlayer.id)) return this.pm(user, "You can only vote for one of the tied players.");
		if (!this.submissions.has(targetPlayer)) return this.pm(user, "Please vote for a user who has submitted an entry.");
		if (this.votes.has(player)) {
			this.pm(user, "Your vote is being overwritten...");
			let previousVote = this.votes.get(player);
			let previousPoints = this.voteNumbers.get(previousVote);
			previousPoints -= 1;
			this.voteNumbers.set(previousVote, previousPoints);
		}
		let votes = this.voteNumbers.get(targetPlayer) || 0;
		votes += 1;
		this.voteNumbers.set(targetPlayer, votes);
		this.votes.set(player, targetPlayer);
		this.pm(user, "Your vote has been entered!");
		this.totalVotes++;
		if (this.totalVotes === this.playerCount) {
			clearTimeout(this.timeout);
			this.parseVotes();
		}
	}
}

exports.name = name;
exports.id = Tools.toId(name);
exports.description = "Our very own Ernest Hemingway game, finally scripted! View the guidelines: https://docs.google.com/document/d/1D1Fgw5rjrr-0wLE9jphtUV7r0AoE8sTrpkYvzcOBPcc/edit#heading=h.ud8axqv1gmve";
exports.commands = {
	"theme": "theme",
	"submit": "submit",
	"vote": "vote",
};
exports.aliases = ['ernest', 'hemingway', 'eh'];
exports.game = ErnestHemingway;
