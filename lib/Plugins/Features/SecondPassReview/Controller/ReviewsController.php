<?php
/**
 * Created by PhpStorm.
 * User: fregini
 * Date: 01/04/2019
 * Time: 17:18
 */

namespace Features\SecondPassReview\Controller;

use API\V2\Exceptions\AuthorizationError;
use API\V2\Exceptions\ValidationError;
use API\V2\KleinController;
use API\V2\Validators\ProjectPasswordValidator;
use API\V2\Validators\TeamAccessFromProjectIdValidator;
use API\V2\Validators\TeamAccessValidator;
use API\V2\Validators\TeamProjectValidator;
use Chunks_ChunkDao;
use LQA\ChunkReviewDao;
use LQA\ChunkReviewStruct;
use RevisionFactory;

class ReviewsController extends KleinController {

    /**
     * @var \Projects_ProjectStruct $project
     */
    protected $project ;

    /**
     * @var ChunkReviewStruct
     */
    protected $chunk ;

    protected $nextSourcePage ;

    /**
     * @var ChunkReviewStruct
     */
    protected $latestChunkReview ;

    /**
     * @throws ValidationError
     * @throws \Exceptions\ValidationError
     */
    public function createReview() {

        // append TeamProjectValidator
        $this->_appendTeamProjectValidator();

        // create a new chunk revision password
        $records = RevisionFactory::initFromProject($this->project)->getFeature()->createQaChunkReviewRecord(
                $this->chunk->id,
                $this->project->id,
                [
                        'source_page' => $this->nextSourcePage
                ]
        );

        $this->response->json( [ 'chunk_review' => [
                'id'              => $records[ 0 ]->id ,
                'id_job'          => $records[ 0 ]->id_job ,
                'review_password' => $records[ 0 ]->review_password ]
                ]
        ) ;
    }

    /**
     * @throws ValidationError
     */
    private function _appendTeamProjectValidator() {
        $validator = ( new TeamProjectValidator( $this ) )->setProject( $this->project ) ;
        $this->appendValidator($validator);
        $this->validateRequest();
    }

    protected function afterConstruct() {
        $Validator = new ProjectPasswordValidator( $this ) ;
        $Controller = $this;
        $Validator->onSuccess( function () use ( $Validator, $Controller ) {
            $Controller->setProject( $Validator->getProject() );
        } );
        $this->appendValidator( $Validator );

    }

    protected function validateRequest() {
        parent::validateRequest(); // TODO: Change the autogenerated stub

        $post = $this->request->paramsPost();

        if ( ! isset( $post['id_job'] ) ) {
            throw new ValidationError('id_job param is not provided' ) ;
        }

        if ( ! isset( $post['revision_number'] ) ) {
            throw new ValidationError('revision_number is not provided' ) ;
        }

        $this->latestChunkReview = ( new ChunkReviewDao())->findLatestRevisionByIdJob( $post['id_job'] ) ;
        if ( $this->latestChunkReview->id_project != $this->project->id ) {
            throw new ValidationError("Job id is not in projects list") ;
        }

        $this->nextSourcePage = $post['revision_number'] + 1 ;
        if ( $this->latestChunkReview->source_page + 1 != $this->nextSourcePage ) {
            throw new ValidationError("This revision number is not allowed") ;
        }

        $this->chunk = $this->latestChunkReview->getChunk() ;

    }

    public function setProject( $project ) {
        $this->project = $project;
    }

}