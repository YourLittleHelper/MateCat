<?php

namespace Features\TranslationVersions;

use Chunks_ChunkStruct;
use Constants_TranslationStatus;
use Features;
use Features\TranslationVersions\Model\TranslationVersionDao;
use Features\TranslationVersions\Model\TranslationVersionStruct;
use Projects_ProjectStruct;
use ReflectionException;
use Translations_SegmentTranslationStruct;
use Users_UserStruct;

/**
 * Class SegmentTranslationVersionHandler
 *
 */
class SegmentTranslationVersionHandler implements VersionHandlerInterface {

    /**
     * @var TranslationVersionDao
     */
    private $dao;

    private $id_job;

    /**
     * @var Chunks_ChunkStruct
     */
    private $chunkStruct;

    private $id_segment;
    private $uid;


    public function __construct( Chunks_ChunkStruct $chunkStruct, $id_segment, Users_UserStruct $userStruct, Projects_ProjectStruct $projectStruct ) {

        $this->chunkStruct = $chunkStruct;
        $this->id_job      = $chunkStruct->id;
        $this->id_segment  = $id_segment;
        $this->uid         = $userStruct->uid;
        $this->dao         = new TranslationVersionDao();

    }

    /**
     * @param Translations_SegmentTranslationStruct $propagation
     */
    public function savePropagationVersions( Translations_SegmentTranslationStruct $propagation ) {

        $this->dao->savePropagationVersions(
                $propagation,
                $this->id_segment,
                $this->chunkStruct
        );

    }

    /**
     * Evaluates the need to save a new translation version to database.
     * If so, sets the new version number on $new_translation.
     *
     * @param Translations_SegmentTranslationStruct $new_translation
     * @param Translations_SegmentTranslationStruct $old_translation
     *
     * @return bool|int
     * @throws ReflectionException
     */
    public function saveVersion(
            Translations_SegmentTranslationStruct $new_translation,
            Translations_SegmentTranslationStruct $old_translation
    ) {

        if (
                empty( $old_translation ) ||
                $this->translationIsEqual( $new_translation, $old_translation )
        ) {
            return false;
        }

        // From now on, translations are treated as arrays and get attributes attached
        // just to be passed to version save. Create two arrays for the purpose.
        $new_version = new TranslationVersionStruct( $old_translation->toArray() );

        // TODO: this is to be reviewed
        $new_version->is_review  = ( $old_translation->status == Constants_TranslationStatus::STATUS_APPROVED ) ? 1 : 0;
        $new_version->old_status = Constants_TranslationStatus::$DB_STATUSES_MAP[ $old_translation->status ];
        $new_version->new_status = Constants_TranslationStatus::$DB_STATUSES_MAP[ $new_translation->status ];

        /**
         * In some cases, version 0 may already be there among saved_versions, because
         * an issue for ReviewExtended has been saved on version 0.
         *
         * In any other case we expect the version record NOT to be there when we reach this point.
         *
         * @param TranslationVersionStruct $version
         *
         * @return bool|int
         *
         */
        $version_record = $this->dao->getVersionNumberForTranslation(
                $this->id_job, $this->id_segment, $new_version->version_number
        );

        if ( $version_record ) {
            return $this->dao->updateVersion( $new_version );
        }

        return $this->dao->saveVersion( $new_version );
    }

    /**
     * translationIsEqual
     *
     * This function needs to handle a special case. When old translation has been saved from a pre-translated XLIFF,
     * encoding is different than the one receiveed from the UI. Quotes are different for instance.
     *
     * So we compare the decoded version of the two strings. Should always work.
     *
     * TODO: this may give false negatives when string changes but decoded version doesn't
     *
     * @param $new_translation
     * @param $old_translation
     *
     * @return bool
     */
    private function translationIsEqual(
            Translations_SegmentTranslationStruct $new_translation,
            Translations_SegmentTranslationStruct $old_translation
    ) {
        $old = html_entity_decode( $old_translation->translation, ENT_XML1 | ENT_QUOTES );
        $new = html_entity_decode( $new_translation->translation, ENT_XML1 | ENT_QUOTES );

        return $new == $old;
    }

}
