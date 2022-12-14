import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Clipboard } from "@angular/cdk/clipboard";
import { ActivatedRoute } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { Subscription } from 'rxjs';
import { CryptoWalletService } from '../crypto-wallet.service';
import { NftActionsService } from '../nft-actions.service';
import { NftContractsService } from '../nft-contracts.service';
import { NotifyService } from '../notify.service';
import { TRANSACTIONURL } from '../constants';
import * as _ from "lodash";

@Component({
    selector: 'app-detail-page',
    templateUrl: './detail-page.component.html',
    styleUrls: ['./detail-page.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailPageComponent implements OnInit, OnDestroy {

    public tranurl = TRANSACTIONURL;
    public id;
    public address;
    public fighter;
    public attacker;
    public deffender;
    public showCanFight = false;
    public waiting = false;
    public allowed = { allowed: false, needed: "0" };
    public allowedKennel = { allowed: false, needed: "0" };
    public showName = false;
    public showDialog = false;
    public attackResults;
    public fighterName = "";
    public prices: {
        address: string; tokenAddress: string; armorPrice: number; trainingPrice: number; tokenSymbol: string, lvlUpPrice: number; fightPrice: number; namePrice: number; fightSymbol: string;
        origArmorPrice: number; origLvlUpPrice: number; origTrainingPrice: number; origFightPrice: number; origNamePrice: number
    } =
        {
            address: undefined, tokenAddress: undefined, armorPrice: undefined, trainingPrice: undefined, tokenSymbol: undefined, lvlUpPrice: undefined, fightPrice: undefined, namePrice: undefined, fightSymbol: undefined,
            origArmorPrice: undefined, origLvlUpPrice: undefined, origTrainingPrice: undefined, origFightPrice: undefined, origNamePrice: undefined
        };
    public tx = "";
    private subscription: Subscription = new Subscription();
    public get walletInfo(): any {
        return this.cryptoWalletService.walletInfo;
    };

    constructor(private route: ActivatedRoute,
        private nftContractsService: NftContractsService,
        private cryptoWalletService: CryptoWalletService,
        private nftActionsService: NftActionsService,
        private clipboard: Clipboard,
        private ngxSpinnerService: NgxSpinnerService,
        private cd: ChangeDetectorRef,
        private notifyService: NotifyService) { }

    async ngOnInit() {
        this.ngxSpinnerService.show();
        this.cd.detectChanges();
        this.id = this.route.snapshot.params['id'];
        this.address = this.route.snapshot.params['address'];
        console.log("this.id", this.id, this.address);
        this.prices = await this.nftContractsService.getPrices(this.address);
        this.subscribeToTransactions();
        this.subscribeToWallet();
        this.fighter = await this.nftContractsService.getFighterBasicInfo(this.address, this.id);
        console.log("this.fighterInfo", this.fighter);
        this.ngxSpinnerService.hide();
        this.cd.detectChanges();
    }


    public async fight(fighter) {
        const result = await this.cryptoWalletService.fight(fighter.token, this.address, this.prices.origFightPrice);
        if (result.result === true) {
            fighter.waiting = true;
            fighter.tx = result.data;
        } else {
            fighter.waiting = false;
        }
        this.cd.detectChanges();
    }

    public async train(fighter) {
        const result = await this.cryptoWalletService.train(fighter.token, this.address, this.prices.origTrainingPrice);
        if (result.result === true) {
            fighter.waiting = true;
            fighter.tx = result.data;
        } else {
            fighter.waiting = false;
        }
        this.cd.detectChanges();
    }

    public async levelUp(fighter) {
        const result = await this.cryptoWalletService.levelUp(fighter.token, this.address, this.prices.origLvlUpPrice);
        if (result.result === true) {
            fighter.waiting = true;
            fighter.tx = result.data;
        } else {
            fighter.waiting = false;
        }
        this.cd.detectChanges();
    }

    public async refillArmor(fighter) {
        const result = await this.cryptoWalletService.refillArmor(fighter.token, this.address, this.prices.origArmorPrice);
        if (result.result === true) {
            fighter.waiting = true;
            fighter.tx = result.data;
        } else {
            fighter.waiting = false;
        }
        this.cd.detectChanges();
    }

    private subscribeToWallet() {
        this.subscription.add(this.cryptoWalletService.updated$.subscribe(async (data) => {
            if (this.walletInfo?.isConnected === true) {
                const allowed = await this.cryptoWalletService.checkAllowed(this.address);
                this.allowed = allowed;
                const allowedKennel = await this.cryptoWalletService.checkAllowedKennel();
                this.allowedKennel = allowedKennel;
                this.showCanFight = await this.cryptoWalletService.showCanFight(this.address, this.id);
            } else {
                this.allowed = { allowed: false, needed: "0" };
                this.allowedKennel = { allowed: false, needed: "0" };
                this.showCanFight = false;
            }
            this.cd.detectChanges();
        }));
    }

    private async checkResults(receipt) {
        let attackResult;
        if (receipt.events && receipt.events.attackResult) {
            attackResult = { ..._.cloneDeep(receipt.events.attackResult.returnValues), result: receipt.events.attackResult.returnValues.AttackSuccess === true ? "Win" : "Lost" };
        }

        if (attackResult) {
            const defender = await this.nftContractsService.getFighterBasicInfo(attackResult.defenderContract, attackResult.defender);
            this.attackResults = { attacker: this.fighter, defender, result: attackResult.result, prize: (attackResult.prize / (10 ** 18)).toFixed(7) };
            this.showDialog = true;
            this.cd.detectChanges();
        }
    }

    private subscribeToTransactions() {
        this.subscription.add(this.cryptoWalletService.transactionStatus$.subscribe(async (data) => {
            if (data.status === "Reveal completed") {
                const fighter = this.fighter.token === data.data ? this.fighter : undefined;

                if (fighter) {
                    fighter.imageUploaded = true;
                    fighter.waiting = false;
                    fighter.tx = undefined;
                    this.notifyService.pop("success", "Your fighter was succesfully updated", "Reveal fighter");
                }
            } else if (data.status === "Name completed") {
                const fighter = this.fighter.token === data.data ? this.fighter : undefined;

                if (fighter) {
                    fighter.waiting = false;
                    fighter.tx = undefined;
                    this.fighter = await this.nftContractsService.getFighterBasicInfo(this.address, this.id);
                    this.notifyService.pop("success", "Your fighter was succesfully updated", "Name fighter");
                }
            } else if (data.status === "Fight completed") {
                const fighter = this.fighter.token === data.data.tokenId ? this.fighter : undefined;

                if (fighter) {
                    this.showCanFight = await this.cryptoWalletService.showCanFight(this.address, this.id);
                    this.fighter = await this.nftContractsService.getFighterBasicInfo(this.address, this.id);
                    fighter.waiting = false;
                    fighter.tx = undefined;
                    this.checkResults(data.data);
                    this.notifyService.pop("success", "Fight finished ...", "Fight completed");
                }
            } else if (data.status === "Training completed") {
                const fighter = this.fighter.token === data.data ? this.fighter : undefined;
                if (fighter) {
                    fighter.waiting = false;
                    fighter.tx = undefined;
                    this.fighter = await this.nftContractsService.getFighterBasicInfo(this.address, this.id);
                    this.notifyService.pop("success", "Your fighter was succesfully updated", "Training completed");
                }
            } else if (data.status === "NFT cancelled") {
                const fighter = (this.fighter.token === (data?.data?.tokenId ? data.data?.tokenId : data.data)) ? this.fighter : undefined;
                if (fighter) {
                    fighter.waiting = false;
                }
                this.waiting = false;
            } else if (data.status === "Refill completed") {
                const fighter = this.fighter.token === data.data ? this.fighter : undefined;
                console.log("Refill completed", data.data);

                if (fighter) {
                    fighter.waiting = false;
                    fighter.tx = undefined;
                    this.fighter = await this.nftContractsService.getFighterBasicInfo(this.address, this.id);
                    this.notifyService.pop("success", "Your fighter's armor succesfully updated", "Refill completed");
                }
            } else if (data.status === "LvlUp completed") {
                const fighter = this.fighter.token === data.data ? this.fighter : undefined;
                console.log("LvlUp completed", data.data);

                if (fighter) {
                    fighter.waiting = false;
                    fighter.tx = undefined;
                    this.fighter = await this.nftContractsService.getFighterBasicInfo(this.address, this.id);
                    this.notifyService.pop("success", "Your fighter is upgraded", "LevelUp completed");
                }
            }

            this.cd.detectChanges();
        }));
    }

    public nameFighterPrep() {
        this.showName = true;
    }

    public async revealFighter(fighter) {
        // pass fighter name to contract
        this.notifyService.pop("info", "Preparing data for fighter", "Reveal fighter");
        fighter.waiting = true;
        this.cd.detectChanges();
        await this.nftActionsService.revealFighter(fighter, this.address);
        this.cd.detectChanges();
    }

    public async nameFighter(fighter) {
        this.showName = false;
        if (this.fighterName) {
            // pass fighter name to contract
            const result = await this.cryptoWalletService.nameFighter(fighter.token, this.address, this.fighterName, this.prices.origNamePrice);
            if (result.result === true) {
                fighter.tx = result.data;
                fighter.waiting = true;
                this.cd.detectChanges();
            }
            this.fighterName = "";
        } else {
            this.notifyService.pop("error", "Missing fighter name", "Name fighter problem");
        }
    }

    // public challengeCopy() {
    //     this.clipboard.copy(this.address + "/" + this.id);
    // }

    ngOnDestroy() {
        this.subscription.unsubscribe();
    }
}
